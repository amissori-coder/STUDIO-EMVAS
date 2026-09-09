#!/bin/bash
# Ripristino di Studio EMVAS da un backup prodotto da deploy/backup.sh.
# Uso: deploy/ripristina.sh /var/backups/studio-emvas/database/emvas-20260907-0300.db.gz
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/studio-emvas}"
ARCHIVIO="${1:-}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/studio-emvas}"

if [ -z "$ARCHIVIO" ] || [ ! -f "$ARCHIVIO" ]; then
  echo "Uso: $0 <file-backup-database.db.gz>" >&2
  echo "Backup disponibili:" >&2
  ls -1t "$BACKUP_DIR/database"/*.db.gz 2>/dev/null | head -10 >&2 || true
  exit 1
fi

cd "$APP_DIR"
echo "[ripristino] arresto dell'applicazione"
docker compose stop app

TS="$(date +%Y%m%d-%H%M%S)"
if [ -f data/emvas.db ]; then
  mv data/emvas.db "data/emvas.db.prima-del-ripristino-$TS"
  echo "[ripristino] database precedente conservato in data/emvas.db.prima-del-ripristino-$TS"
fi
gunzip -c "$ARCHIVIO" > data/emvas.db

if [ -d "$BACKUP_DIR/documenti" ]; then
  echo "[ripristino] ripristino documenti"
  mkdir -p data/uploads
  rsync -a "$BACKUP_DIR/documenti/" data/uploads/
fi

echo "[ripristino] riavvio dell'applicazione"
docker compose up -d app
echo "[ripristino] completato: verifica l'accesso all'applicazione"
