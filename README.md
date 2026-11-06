# Data_Quality_Services_HS_Aalen

This project contains the Data Quality React/Vite frontend and Flask backend.
It can be moved to another directory or repository and runs without the parent
AI services project. Starting it launches only `frontend` and `backend`.

## Start

Install Docker with Docker Compose, then run:

```bash
cd Data_Quality_Services_HS_Aalen
./start.sh
```

Open http://localhost:8503. The script generates a local `.env` with a random
session secret on first use and builds both images. The first build downloads
large ML dependencies and requires internet access and sufficient disk space.
No private container registry or parent `.env` is required.

To run in the background:

```bash
./start.sh -d
```

To stop this project:

```bash
cd Data_Quality_Services_HS_Aalen
docker compose -f docker-compose.yml down
```

View logs with `docker compose -f docker-compose.yml logs -f`.
Use the explicit Compose file in manual commands to keep this project's scope clear.
Port 8503 must be free; stop an existing Data Quality frontend before starting.

## Rebuild after changes

To rebuild and restart the frontend or backend after editing its code:

```bash
docker compose -f docker-compose.yml up -d --build frontend
docker compose -f docker-compose.yml up -d --build backend
```

To rebuild and restart both services, run `./start.sh -d`.

## Dependency files

- `requirements-base.txt` contains the shared Python/ML dependencies.
- `BE/requirements.txt` contains the backend-specific Python dependencies.
  The backend Dockerfile installs both files together.
- `FE/package.json` declares the frontend dependencies.

`Dockerfile.base` is an optional standalone base-image build and uses
`requirements-base.txt`. The normal Compose build installs dependencies directly
and does not require this base image or publishing images to a registry.

## Upload formats and task identification

Uploads support CSV, TSV, XLSX, ARFF, JSON, JSONL, TXT, DAT, DATA, Arrow,
Feather, and Parquet files. The upload dialog reads the file through the backend
loader before presenting the target-column selector.

In the upload dialog's LLM settings, enable **Use LLM for ML Task Type
Identification** to classify the selected target as a Tabular or Time Series
task and identify it as binary, multiclass, or regression. This option is off
by default and uses the configured backend LLM. The EXP2-inspired prompt
adaptation and its license attribution are documented in
[`BE/THIRD_PARTY_NOTICES.md`](BE/THIRD_PARTY_NOTICES.md).

The LLM model can be selected in the same upload settings. Qwen3 4B Instruct
is the default; Qwen3 4B Thinking is also available. The selected model is
downloaded on first use, and switching models replaces the currently loaded model.

Qwen2.5 14B Instruct is also listed when an NVIDIA CUDA GPU is available. It
uses 4-bit quantization and is not supported on CPU-only hosts.

## NVIDIA GPU (optional)

With NVIDIA drivers and the NVIDIA Container Toolkit installed:

```bash
./start.sh --gpu -d
curl http://localhost:8503/status
```

Check `gpu.cuda_available` in the response. Without GPU access the application
uses CPU. The default image architecture is linux/amd64; Apple Silicon uses
emulation. GPU support is intended for Linux NVIDIA hosts.

## Configuration and data

`start.sh` uses only this folder's `.env` and Compose files, even when invoked
from another directory. For manual setup, create `.env` using `.env.example`
and replace `SECRET_KEY` with a random value before running Compose.
The backend is reachable internally as `backend:5000`; the frontend proxies
requests to it. No other services are needed.

The extraction retains application code, bundled models and dictionaries.
Previous uploads, sessions, generated reports and experimental datasets were
excluded. Working data lives inside the backend container and is removed when
the container is removed or recreated; download results before doing so.
LLM features may download models on first use and can be slow on CPU.
