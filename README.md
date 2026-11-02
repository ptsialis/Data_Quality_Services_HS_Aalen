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

Original application notes and known issues are in `UPSTREAM_NOTES.md`;
use this README for standalone startup instructions.
