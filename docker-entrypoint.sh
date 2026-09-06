#!/bin/sh
set -e
# Applica lo schema al database SQLite (crea il file se non esiste) e carica il seed idempotente
# (amministratore iniziale + catalogo adempimenti).
npx prisma db push --skip-generate >/dev/null
npx tsx prisma/seed.ts || echo "[avvio] seed non eseguito"
exec "$@"
