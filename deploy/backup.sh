#!/bin/bash
# Backup notturno di Studio EMVAS: copia coerente del database SQLite e specchio dei documenti.
# Uso: deploy/backup.sh [cartella-destinazione]
# Installato dal cron da deploy/prepara-server.sh.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/studio-emvas}"
DEST="${1:-${BACKUP_DIR:-/var/backups/studio-emvas}}"
GIORNI_DA_CONSERVARE="${GIORNI_DA_CONSERVARE:-30}"
DATA_DIR="$APP_DIR/data"
DB="$DATA_DIR/emvas.db"
STAMP="$(date +%Y%m%d-%H%M)"

for comando in sqlite3 rsync; do
  if ! command -v "$comando" >/dev/null 2>&1; then
    echo "[backup] manca il comando $comando: installalo con  apt-get install -y sqlite3 rsync" >&2
    exit 1
  fi
done

if [ ! -f "$DB" ]; then
  echo "[backup] database non trovato in $DB" >&2
  exit 1
fi
mkdir -p "$DEST/database" "$DEST/documenti"

# .backup produce una copia integra anche mentre l'applicazione sta scrivendo:
# copiare il file con cp può invece salvare un database corrotto.
sqlite3 "$DB" ".backup '$DEST/database/emvas-$STAMP.db'"
gzip -f "$DEST/database/emvas-$STAMP.db"

# I documenti caricati sono molti e non cambiano: si sincronizzano invece di riarchiviarli ogni notte.
if [ -d "$DATA_DIR/uploads" ]; then
  rsync -a --delete "$DATA_DIR/uploads/" "$DEST/documenti/"
fi

find "$DEST/database" -name 'emvas-*.db.gz' -mtime +"$GIORNI_DA_CONSERVARE" -delete

DIM="$(du -sh "$DEST" 2>/dev/null | cut -f1)"
echo "[backup] $STAMP completato in $DEST (totale $DIM)"

# Avviso quando lo spazio sui dischi che ospitano dati o backup sta finendo.
for percorso in "$DATA_DIR" "$DEST"; do
  USATO="$(df --output=pcent "$percorso" 2>/dev/null | tail -1 | tr -dc '0-9')"
  LIBERO="$(df -h --output=avail "$percorso" 2>/dev/null | tail -1 | tr -d ' ')"
  if [ -n "$USATO" ] && [ "$USATO" -ge 80 ]; then
    echo "[backup] ATTENZIONE: il disco di $percorso e' pieno al $USATO% (liberi $LIBERO). Amplia il volume." >&2
  fi
done
