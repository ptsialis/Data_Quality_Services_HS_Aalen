"""Run Gemma 4 in its own Python environment and expose the chat pipeline interface."""

import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import traceback
import weakref


def _stop_worker(process):
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
    process.stdin.close()
    process.stdout.close()


class Gemma4ChatAdapter:
    def __init__(self, model_id, quantization):
        self._command = [
            os.environ.get("GEMMA4_PYTHON", "/opt/gemma4/bin/python"),
            str(Path(__file__).resolve()),
            model_id,
            quantization,
        ]
        self._lock = threading.Lock()
        self._process = None
        self._start_worker()

    def _start_worker(self):
        self._process = subprocess.Popen(
            self._command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
            encoding="utf-8",
        )
        self._stop = weakref.finalize(self, _stop_worker, self._process)
        try:
            self._read_reply()
        except BaseException:
            self._stop()
            raise

    def _read_reply(self):
        line = self._process.stdout.readline()
        if not line:
            raise RuntimeError("Gemma 4 worker exited. Check the backend logs.")
        reply = json.loads(line)
        if "error" in reply:
            raise RuntimeError(reply["error"])
        return reply

    def __call__(self, messages, return_full_text=False, **generation_kwargs):
        with self._lock:
            if self._process.poll() is not None:
                self._stop()
                self._start_worker()

            request = {"messages": messages, "generation_kwargs": generation_kwargs}
            self._process.stdin.write(json.dumps(request) + "\n")
            self._process.stdin.flush()
            response = self._read_reply()["text"]

        assistant_message = {"role": "assistant", "content": response}
        turns = [*messages, assistant_message] if return_full_text else [assistant_message]
        return [{"generated_text": turns}]


def _serve(model_id, quantization):
    # Reserve stdout for the protocol even if a dependency prints during loading.
    with os.fdopen(os.dup(sys.stdout.fileno()), "w", encoding="utf-8") as replies:
        os.dup2(sys.stderr.fileno(), sys.stdout.fileno())

        def reply(payload):
            print(json.dumps(payload), file=replies, flush=True)

        try:
            import torch
            from transformers import AutoModelForMultimodalLM, AutoProcessor, BitsAndBytesConfig

            cuda_available = torch.cuda.is_available()
            model_kwargs = {
                "device_map": "auto" if cuda_available else "cpu",
                "dtype": (
                    torch.bfloat16
                    if cuda_available and torch.cuda.is_bf16_supported()
                    else torch.float32
                ),
            }
            if cuda_available and quantization in {"8bit", "4bit"}:
                model_kwargs["quantization_config"] = BitsAndBytesConfig(
                    load_in_8bit=quantization == "8bit",
                    load_in_4bit=quantization == "4bit",
                    bnb_4bit_compute_dtype=model_kwargs["dtype"],
                )
            elif cuda_available and quantization == "16bit":
                model_kwargs["dtype"] = torch.float16

            processor = AutoProcessor.from_pretrained(model_id)
            model = AutoModelForMultimodalLM.from_pretrained(model_id, **model_kwargs)
            reply({"ready": True})
        except Exception as exc:
            traceback.print_exc()
            reply({"error": str(exc)})
            return

        for line in sys.stdin:
            try:
                request = json.loads(line)
                messages = [
                    {**message, "content": [{"type": "text", "text": message["content"]}]}
                    if isinstance(message["content"], str)
                    else message
                    for message in request["messages"]
                ]
                inputs = processor.apply_chat_template(
                    messages,
                    tokenize=True,
                    return_dict=True,
                    return_tensors="pt",
                    add_generation_prompt=True,
                    enable_thinking=False,
                ).to(model.device)
                generation_kwargs = request["generation_kwargs"]
                if not generation_kwargs.get("do_sample", False):
                    for key in ("temperature", "top_p", "top_k"):
                        generation_kwargs.pop(key, None)
                with torch.inference_mode():
                    output = model.generate(**inputs, **generation_kwargs)
                generated_ids = output[0, inputs["input_ids"].shape[-1]:]
                response = processor.decode(generated_ids, skip_special_tokens=True)
                reply({"text": response.strip()})
            except Exception as exc:
                traceback.print_exc()
                reply({"error": str(exc)})


if __name__ == "__main__":
    _serve(*sys.argv[1:])
