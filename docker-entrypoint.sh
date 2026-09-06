#!/bin/sh
set -e
# Applica lo schema al database SQLite (crea il file se non esiste) e carica il seed idempotente.
node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss >/dev/null
node node_modules/tsx/dist/cli.mjs prisma/seed.ts || echo "[avvio] seed non eseguito"
exec "$@"
