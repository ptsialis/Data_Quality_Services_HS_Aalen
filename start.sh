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

gpu=false
pull=false
publish=false
detach=false
compose_args=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        --gpu)
            gpu=true
            shift
            ;;
        --pull)
            pull=true
            shift
            ;;
        --publish)
            publish=true
            shift
            ;;
        -d|--detach)
            detach=true
            shift
            ;;
        *)
            compose_args+=("$1")
            shift
            ;;
    esac
done

if [[ "$pull" == true && "$publish" == true ]]; then
    echo 'Use either --pull or --publish, not both.' >&2
    exit 2
fi

if [[ "$publish" == true ]]; then
    backend_image="ghcr.io/ptsialis/data-quality-services-backend:latest"
    frontend_image="ghcr.io/ptsialis/data-quality-services-frontend:latest"

    echo "Building $backend_image..."
    docker build -f "$PWD/BE/Dockerfile" -t "$backend_image" "$PWD"

    echo "Building $frontend_image..."
    docker build -f "$PWD/FE/Dockerfile" -t "$frontend_image" "$PWD/FE"

    echo 'Pushing published Data Quality images...'
    docker push "$backend_image"
    docker push "$frontend_image"
    echo 'Images pushed. Set each GHCR package visibility to Public if it is not public already.'
    exit 0
fi

compose=(docker compose --project-directory "$PWD" --env-file "$PWD/.env")
if [[ "$pull" == true ]]; then
    compose+=(-f "$PWD/docker-compose.release.yml")
else
    compose+=(-f "$PWD/docker-compose.yml")
fi
if [[ "$gpu" == true ]]; then
    compose+=(-f "$PWD/docker-compose.gpu.yml")
fi

if [[ "$pull" == true ]]; then
    echo 'Pulling published Data Quality images...'
    "${compose[@]}" pull backend frontend
fi

echo 'Starting Data Quality at http://localhost:8503'
up_args=(up)
if [[ "$detach" == true ]]; then
    up_args+=(-d)
fi
if [[ "$pull" == false ]]; then
    up_args+=(--build)
fi
up_args+=("${compose_args[@]}")
exec "${compose[@]}" "${up_args[@]}"
