#!/usr/bin/env bash
set -euo pipefail

./scripts/test.sh

if [[ -z "${DATABASE_URL:-}" || -z "${EVENT_ID:-}" ]]; then
  echo "DATABASE_URL y EVENT_ID son requeridos para verify-consistency.sh" >&2
  exit 1
fi

./loadtests/verify-consistency.sh
