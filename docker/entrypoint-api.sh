#!/bin/sh
set -e
cd /app/backend

if [ ! -f data/app-data.json ] && [ -f data/app-data.example.json ]; then
  cp data/app-data.example.json data/app-data.json
fi

exec node server.js
