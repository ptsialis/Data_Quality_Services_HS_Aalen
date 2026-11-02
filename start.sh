#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
    echo 'Docker with the Compose plugin is required.' >&2
    exit 1
fi

# Create an independent secret once; never copy the parent project's credentials.
if [[ ! -f .env ]]; then
    (umask 077; printf 'SECRET_KEY=%s\n' "$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')" > .env)
fi

compose=(docker compose --project-directory "$PWD" --env-file "$PWD/.env" -f "$PWD/docker-compose.yml")
if [[ "${1:-}" == '--gpu' ]]; then
    compose+=(-f "$PWD/docker-compose.gpu.yml")
    shift
fi

echo 'Starting Data Quality at http://localhost:8503'
exec "${compose[@]}" up --build "$@"
