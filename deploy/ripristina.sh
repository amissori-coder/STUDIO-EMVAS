#!/bin/bash
# Ripristino di Studio EMVAS da un backup prodotto da deploy/backup.sh.
# Uso: deploy/ripristina.sh /var/backups/studio-emvas/database/emvas-20260907-0300.db.gz
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/studio-emvas}"
# shellcheck source=deploy/comune.sh
source "$(dirname "$0")/comune.sh"

ARCHIVIO="${1:-}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/studio-emvas}"

if [ -z "$ARCHIVIO" ] || [ ! -f "$ARCHIVIO" ]; then
  echo "Uso: $0 <file-backup-database.db.gz>" >&2
  echo "Backup disponibili:" >&2
  ls -1t "$BACKUP_DIR/database"/*.db.gz 2>/dev/null | head -10 >&2 || true
  exit 1
fi

# Si controlla l'archivio PRIMA di fermare l'applicazione e di spostare il database attuale:
# un file troncato produrrebbe un database rotto al posto di quello buono.
if ! gzip -t "$ARCHIVIO" 2>/dev/null; then
  echo "[ripristino] l'archivio $ARCHIVIO è danneggiato: scegline un altro. Nulla è stato modificato." >&2
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

# I documenti tornano nella cartella che l'applicazione usa davvero (UPLOADS_PATH se impostata),
# senza cancellare nulla di quello che c'è già.
DESTINAZIONE="$(cartella_documenti)"
NEL_BACKUP="$(find "$BACKUP_DIR/documenti" -type f 2>/dev/null | wc -l)"
if [ "$NEL_BACKUP" -gt 0 ]; then
  echo "[ripristino] ripristino di $(plurale "$NEL_BACKUP" documento documenti) in $DESTINAZIONE"
  mkdir -p "$DESTINAZIONE"
  rsync -a "$BACKUP_DIR/documenti/" "$DESTINAZIONE/"
else
  echo "[ripristino] lo specchio dei documenti in $BACKUP_DIR/documenti è vuoto: documenti non toccati"
fi

echo "[ripristino] riavvio dell'applicazione"
docker compose up -d app
echo "[ripristino] completato: verifica l'accesso all'applicazione"
