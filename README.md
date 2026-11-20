# Data Quality AI Service

A web service for preparing and assessing tabular datasets. Users can review analysis results and download processed data and metadata.

## What it does

- **Feature type inference:** Assigns semantic types to dataset columns, such as numeric, categorical, sentence, URL, list, embedded number, context-specific, non-generalizable, or datetime. These types help downstream processing handle columns appropriately.
- **Personal data detection:** Identifies columns that may contain personal or sensitive information by analyzing column names and values, with an optional dataset description. See the [personal-data detection paper](https://arxiv.org/abs/2506.22305).
- **Missing-value imputation:** Fills missing tabular values with the mean for numeric columns and the mode for other columns. This is a low-cost default; the cited [imputation study](https://dl.acm.org/doi/full/10.1145/3643643 ) reports results competitive with more complex approaches.
- **Anomaly detection:** Flags unusual rows in tabular or time-series data to help identify possible errors, sensor faults, or rare events. The tabular detector uses [PyOD](https://github.com/yzhao062/pyod); see also this [time-series anomaly detection paper](https://arxiv.org/abs/2201.07284).
- **ML task-type identification:** When enabled, uses the dataset excerpt, selected target, and optional dataset description to infer whether the data is tabular or time series and whether the target is binary, multiclass, or regression. See [Large Language Models for Automated Cross-Domain Machine Learning Task Type Identification](https://arxiv.org/abs/2609.35335). Other optional AI features can assist with feature and personal-data analysis; available models are described below.

## Basic workflow

1. Upload a dataset. Supported formats include CSV, TSV, XLSX, ARFF, JSON, JSONL, TXT, DAT, DATA, Arrow, Feather, and Parquet.
2. Select a target column when relevant, and choose optional AI analysis settings.
3. Run the analysis. The service performs feature-type inference, imputation, anomaly detection, and the selected personal-data and task-type analyses.
4. Review the results and download processed data or metadata.

The app supports downloads; direct publishing to Piveau is not currently available.

## Run with Docker

Install Docker with the Compose plugin. Clone the repository, enter the project directory, and start in the default CPU mode using the prebuilt Docker images (recommended; no local build required):

```bash
git clone https://github.com/ptsialis/Data_Quality_Services_HS_Aalen.git
cd Data_Quality_Services_HS_Aalen
./start.sh --pull
```

<!-- Windows/Docker Desktop instructions are temporarily commented out.
On Windows, install Docker Desktop with the WSL 2 backend, then run in PowerShell:

```powershell
.\start.ps1 -Pull
```

Use `.\start.ps1 -Pull -Detach` to run in the background. The script checks Docker and Compose, creates `.env` with a random session secret on first start, and pulls the published images.
-->

Open [http://localhost:8503](http://localhost:8503). On first start, the script creates a local `.env` with a random session secret.

The published backend image already includes the default Qwen3 4B Instruct model, so it does not need to be downloaded separately after pulling the image. When building locally, the model is downloaded during the Docker build. Qwen3 4B Thinking and Qwen2.5 14B Instruct remain optional downloads and are fetched when selected for the first time. The 14B model requires a suitable NVIDIA GPU.

To run the published images in the background:

```bash
./start.sh --pull -d
```

To build and run the Docker images locally from source instead:

```bash
./start.sh
```

Stop services started with `--pull` using:

```bash
docker compose -f docker-compose.release.yml down
```

If you built locally instead, use `docker compose -f docker-compose.yml down`.

Uploads support CSV, TSV, XLSX, ARFF, JSON, JSONL, TXT, DAT, DATA, Arrow, Feather, and Parquet.

## CPU and GPU modes

CPU mode is the default and needs no GPU setup. AI model loading and analysis can be slower, particularly with larger models.

For an NVIDIA GPU on Linux, install the NVIDIA drivers and NVIDIA Container Toolkit. The main backend environment uses PyTorch 2.3 with CUDA 12.1 (`cu121`). The host CUDA toolkit does not need to be installed inside the image; GPU access depends on Docker exposing a compatible NVIDIA driver.

Start GPU mode with the published images:

```bash
./start.sh --pull --gpu -d
```

To build and run GPU mode locally instead, use `./start.sh --gpu -d`.

<!--
```powershell
.\start.ps1 -Pull -Gpu -Detach
```
-->

To confirm GPU access after startup, check `http://localhost:8503/status` for `gpu.cuda_available: true`. If it is false, verify Docker and the NVIDIA Container Toolkit before changing Python package versions.

The Docker build installs `requirements-base.txt` and `BE/requirements.txt`. `BE/requirements-current-image.txt` is a captured environment snapshot, not a portable install file; it contains machine-local package references and is not used by the Docker build.

The 14B model option requires CUDA and is unavailable in CPU-only mode.

## AI model choices

The upload settings offer Qwen3 4B Instruct (default), Qwen3 4B Thinking, and Qwen2.5 14B Instruct. The model is used for AI-assisted features only. Gemma 4 E4B support is disabled in the current build.

Larger models can give better results on ambiguous or context-heavy tasks, but this is not guaranteed. They use more memory and can take longer to load and run. Use a 4B model for a faster, lighter option; consider the 14B model when result quality is the priority and a suitable NVIDIA GPU is available.
