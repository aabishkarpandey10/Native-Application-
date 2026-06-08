#!/bin/sh
set -e
cd /app/backend

export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-3000}"
export NODE_ENV="${NODE_ENV:-production}"
export ENABLE_ADMIN="${ENABLE_ADMIN:-true}"

if [ ! -f data/app-data.json ] && [ -f data/app-data.example.json ]; then
  cp data/app-data.example.json data/app-data.json
fi

mkdir -p data/uploads

exec node server.js
