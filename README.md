# Data Quality AI Service

A web service for preparing and assessing tabular datasets. Users can review analysis results and download processed data and metadata.

## What it does

- **Feature type inference:** Assigns semantic types to dataset columns, such as numeric, categorical, sentence, URL, list, embedded number, context-specific, non-generalizable, or datetime. These types help downstream processing handle columns appropriately.
- **Personal data detection:** Identifies columns that may contain personal or sensitive information by analyzing column names and values, with an optional dataset description. See the [personal-data detection paper](https://arxiv.org/abs/2506.22305).
- **Missing-value imputation:** Fills missing tabular values with the mean for numeric columns and the mode for other columns. This is a low-cost default; the cited [imputation study](https://dl.acm.org/doi/full/10.1145/3643643) reports results competitive with more complex approaches.
- **Anomaly detection:** Flags unusual rows in tabular or time-series data to help identify possible errors, sensor faults, or rare events. The tabular detector uses [PyOD](https://github.com/yzhao062/pyod); see also this [time-series anomaly detection paper](https://arxiv.org/abs/2201.07284).
- **Optional AI analysis:** Can identify an ML task type and assist with feature and personal-data analysis. The available language models are described below.

## Basic workflow

1. Upload a dataset. Supported formats include CSV, TSV, XLSX, ARFF, JSON, JSONL, TXT, DAT, DATA, Arrow, Feather, and Parquet.
2. Select a target column when relevant, and choose optional AI analysis settings.
3. Run the analysis. The service performs feature-type inference, imputation, anomaly detection, and the selected personal-data and task-type analyses.
4. Review the results and download processed data or metadata.

The app supports downloads; direct publishing to Piveau is not currently available.

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
