# Data Quality AI Service

A web service for preparing and assessing tabular datasets. It can infer feature types, flag likely personal data, impute missing values, detect anomalies, and generate summaries and metadata. Optional AI features can identify a machine-learning task type and assist with column analysis. Users can review results and download outputs.

## Run with Docker

Install Docker with the Compose plugin. From the project directory, start the default CPU mode:

```bash
./start.sh
```

Open [http://localhost:8503](http://localhost:8503). On first start, the script creates a local `.env` with a random session secret and builds the services. The first build needs internet access and disk space; selected AI models are downloaded when first used.

To run in the background, use `./start.sh -d`. Stop the services with:

```bash
docker compose -f docker-compose.yml down
```

Uploads support CSV, TSV, XLSX, ARFF, JSON, JSONL, TXT, DAT, DATA, Arrow, Feather, and Parquet.

## CPU and GPU modes

CPU mode is the default and needs no GPU setup. AI model loading and analysis can be slower, particularly with larger models.

For an NVIDIA GPU on Linux, install the NVIDIA drivers and NVIDIA Container Toolkit, then start with:

```bash
./start.sh --gpu -d
```

The 14B model option requires CUDA and is unavailable in CPU-only mode. GPU access can be checked at `http://localhost:8503/status` by looking for `gpu.cuda_available: true`.

## AI model choices

The upload settings offer Qwen3 4B Instruct (default), Qwen3 4B Thinking, and Qwen2.5 14B Instruct. The model is used for AI-assisted features; the standard data-quality operations do not require it.

Larger models can give better results on ambiguous or context-heavy tasks, but this is not guaranteed. They use more memory and can take longer to load and run. Use a 4B model for a faster, lighter option; consider the 14B model when result quality is the priority and a suitable NVIDIA GPU is available.
