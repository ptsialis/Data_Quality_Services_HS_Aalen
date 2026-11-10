[CmdletBinding()]
param(
    [switch]$Gpu,
    [switch]$Detach
)

$ErrorActionPreference = "Stop"
$projectDirectory = $PSScriptRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker is required. Install Docker Desktop and make sure 'docker' is on PATH."
}

& docker info --format "{{.ServerVersion}}" *> $null
if ($LASTEXITCODE -ne 0) {
    throw "The Docker daemon is unavailable. Start Docker Desktop and try again."
}

& docker compose version *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose is required. Update Docker Desktop to a version with the Compose plugin."
}

$envFile = Join-Path $projectDirectory ".env"
if (-not (Test-Path -LiteralPath $envFile)) {
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $secretBytes = New-Object byte[] 32
    try {
        $random.GetBytes($secretBytes)
    }
    finally {
        $random.Dispose()
    }
    $secret = -join ($secretBytes | ForEach-Object { $_.ToString("x2") })
    [System.IO.File]::WriteAllText(
        $envFile,
        "SECRET_KEY=$secret`n",
        [System.Text.Encoding]::ASCII
    )
}

$composeArgs = @(
    "compose",
    "--project-directory", $projectDirectory,
    "--env-file", $envFile,
    "-f", (Join-Path $projectDirectory "docker-compose.yml")
)

if ($Gpu) {
    $composeArgs += @("-f", (Join-Path $projectDirectory "docker-compose.gpu.yml"))
}

$composeArgs += "up"
if ($Detach) {
    $composeArgs += "-d"
}
$composeArgs += "--build"

Write-Host "Starting Data Quality at http://localhost:8503"
if ($Gpu) {
    Write-Host "GPU mode requires Docker Desktop with the WSL2 backend and a compatible NVIDIA driver."
}

& docker @composeArgs
exit $LASTEXITCODE
