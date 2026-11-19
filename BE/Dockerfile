# Explicit Debian release avoids unexpected OS changes between builds.
FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get -o Acquire::Retries=3 update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        pkg-config \
        git \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install shared and backend-specific Python dependencies
COPY requirements-base.txt /tmp/requirements-base.txt
COPY BE/requirements.txt /tmp/requirements-backend.txt

RUN python -m pip install \
        --upgrade \
        "pip<25" \
        "setuptools<70" \
        wheel \
    && python -m pip install \
        --no-cache-dir \
        -r /tmp/requirements-base.txt \
        -r /tmp/requirements-backend.txt

# Gemma 4 is disabled. Its separate Python environment preserves Flair compatibility.
# COPY BE/requirements-gemma4.txt /tmp/requirements-gemma4.txt
# RUN python -m venv /opt/gemma4 \
    # && /opt/gemma4/bin/python -m pip install --no-cache-dir -r /tmp/requirements-gemma4.txt
# ENV GEMMA4_PYTHON=/opt/gemma4/bin/python

# Bundle the default LLM weights in the image. Optional larger or specialized
# models remain lazy downloads and are fetched when the user selects them.
ENV HF_HOME=/models/huggingface
RUN mkdir -p /models/huggingface && python - <<'PY'
from huggingface_hub import snapshot_download

snapshot_download(
    repo_id="Qwen/Qwen3-4B-Instruct-2507",
)
PY

# Download required NLTK resources
ENV NLTK_DATA=/usr/local/share/nltk_data

RUN mkdir -p /usr/local/share/nltk_data \
    && python - <<'PY'
import nltk

download_dir = "/usr/local/share/nltk_data"

for package in ("punkt", "punkt_tab", "stopwords"):
    nltk.download(package, download_dir=download_dir)
PY

RUN mkdir -p /usr/local/share/nltk_data/tokenizers/punkt/PY3 \
    && cp /usr/local/share/nltk_data/tokenizers/punkt/*.pickle \
          /usr/local/share/nltk_data/tokenizers/punkt/PY3/ \
       || true

ENV DGLBACKEND=pytorch
ENV FLASK_APP=app.py
ENV FLASK_RUN_HOST=0.0.0.0
ENV FLASK_RUN_PORT=5000
ENV FLASK_ENV=development

COPY BE/. /app

EXPOSE 5000

CMD ["python", "app.py"]
