#!/usr/bin/env bash
set -euo pipefail

# Official clean-machine test entrypoint (Dockerized)
docker compose run --rm api-test
