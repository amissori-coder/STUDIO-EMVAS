#!/bin/bash
# Backup notturno di Studio EMVAS: copia coerente del database SQLite e specchio dei documenti.
# Uso: deploy/backup.sh [cartella-destinazione]
# Installato dal cron da deploy/prepara-server.sh.
#
# Se qualcosa non va a buon fine lo script termina con un codice di errore, ma SOLO DOPO aver comunque
# eseguito la copia del database, la pulizia delle copie vecchie e il controllo dello spazio: un problema
# sui documenti non deve far accumulare copie del database fino a riempire il disco.
set -uo pipefail

APP_DIR="${APP_DIR:-/opt/studio-emvas}"
# shellcheck source=deploy/comune.sh
source "$(dirname "$0")/comune.sh"

DEST="${1:-${BACKUP_DIR:-/var/backups/studio-emvas}}"
GIORNI_DA_CONSERVARE="${GIORNI_DA_CONSERVARE:-30}"
DATA_DIR="$APP_DIR/data"
DB="$DATA_DIR/emvas.db"
STAMP="$(date +%Y%m%d-%H%M)"
ERRORI=0

errore_backup() {
  echo "[backup] ERRORE: $1" >&2
  ERRORI=$((ERRORI + 1))
}

for comando in sqlite3 rsync gzip; do
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

# --- 1. Database ----------------------------------------------------------------------------------
# .backup produce una copia integra anche mentre l'applicazione sta scrivendo:
# copiare il file con cp può invece salvare un database corrotto.
COPIA="$DEST/database/emvas-$STAMP.db"
if sqlite3 "$DB" ".backup '$COPIA'" && gzip -f "$COPIA" && gzip -t "$COPIA.gz"; then
  echo "[backup] database copiato in $(basename "$COPIA").gz"
else
  rm -f "$COPIA" "$COPIA.gz"
  errore_backup "la copia del database non è riuscita"
fi

# --- 2. Documenti ---------------------------------------------------------------------------------
# L'origine è la stessa cartella che l'applicazione usa (UPLOADS_PATH quando i documenti stanno su un
# disco separato). Prima di sincronizzare si confronta con i documenti registrati nel database:
# uno specchio sincronizzato con "--delete" da una cartella sbagliata o da un disco non montato
# verrebbe svuotato proprio nella notte in cui serve.
ORIGINE="$(cartella_documenti)"
REGISTRATI="$(sqlite3 "$DB" 'SELECT COUNT(*) FROM Document;' 2>/dev/null || echo "?")"
STATO="$DEST/stato-documenti.txt"
ESITO_DOC="errore"
MANCANTI="?"

if [ "$REGISTRATI" = "?" ]; then
  errore_backup "non è stato possibile leggere l'elenco dei documenti dal database: specchio non aggiornato"
elif [ ! -d "$ORIGINE" ]; then
  if [ "$REGISTRATI" -gt 0 ]; then
    errore_backup "la cartella dei documenti $ORIGINE non esiste (disco non montato o UPLOADS_PATH sbagliato). Lo specchio è rimasto com'era all'ultimo backup riuscito."
  else
    echo "[backup] nessun documento registrato: niente da copiare"
    ESITO_DOC="completo"; MANCANTI=0
  fi
else
  MANCANTI=0
  while IFS= read -r percorso; do
    [ -z "$percorso" ] && continue
    [ -f "$ORIGINE/$percorso" ] || MANCANTI=$((MANCANTI + 1))
  done < <(sqlite3 "$DB" 'SELECT storagePath FROM Document;')

  if [ "$REGISTRATI" -gt 0 ] && [ "$MANCANTI" -eq "$REGISTRATI" ]; then
    errore_backup "nessuno dei $(plurale "$REGISTRATI" "documento registrato" "documenti registrati") si trova in $ORIGINE (disco non montato o UPLOADS_PATH sbagliato). Lo specchio è rimasto com'era all'ultimo backup riuscito."
  elif [ "$MANCANTI" -gt 0 ]; then
    # Si copia quello che c'è, ma senza cancellare nulla dallo specchio: i file che mancano
    # nell'origine potrebbero esistere solo lì.
    rsync -a "$ORIGINE/" "$DEST/documenti/" && ESITO_DOC="parziale"
    errore_backup "$(plurale "$MANCANTI" "documento registrato non si trova" "documenti registrati non si trovano") in $ORIGINE. Lo specchio è stato aggiornato senza cancellare nulla."
  elif rsync -a --delete "$ORIGINE/" "$DEST/documenti/"; then
    ESITO_DOC="completo"
    echo "[backup] $(plurale "$REGISTRATI" "documento copiato" "documenti copiati") da $ORIGINE"
  else
    errore_backup "la copia dei documenti da $ORIGINE non è riuscita"
  fi
fi

# L'esito di OGNI notte, anche di quelle andate male: verifica.sh lo legge, così un disco smontato
# si vede la mattina dopo e non quando l'ultima notte riuscita è ormai vecchia.
ULTIMO_COMPLETO="$(sed -n 's/^ultimo_completo=//p' "$STATO" 2>/dev/null)"
[ "$ESITO_DOC" = "completo" ] && ULTIMO_COMPLETO="$STAMP"
printf 'data=%s\nesito=%s\nregistrati=%s\nmancanti=%s\norigine=%s\nultimo_completo=%s\n' \
  "$STAMP" "$ESITO_DOC" "$REGISTRATI" "$MANCANTI" "$ORIGINE" "${ULTIMO_COMPLETO:-mai}" > "$STATO"

# --- 3. Pulizia delle copie vecchie (sempre, anche dopo un errore) --------------------------------
find "$DEST/database" -name 'emvas-*.db.gz' -mtime +"$GIORNI_DA_CONSERVARE" -delete

# --- 4. Spazio sui dischi (sempre) ----------------------------------------------------------------
for percorso in "$DATA_DIR" "$ORIGINE" "$DEST"; do
  [ -e "$percorso" ] || continue
  USATO="$(df --output=pcent "$percorso" 2>/dev/null | tail -1 | tr -dc '0-9')"
  LIBERO="$(df -h --output=avail "$percorso" 2>/dev/null | tail -1 | tr -d ' ')"
  if [ -n "$USATO" ] && [ "$USATO" -ge 80 ]; then
    echo "[backup] ATTENZIONE: il disco di $percorso è pieno al $USATO% (liberi $LIBERO). Amplia il volume." >&2
  fi
done

DIM="$(du -sh "$DEST" 2>/dev/null | cut -f1)"
if [ "$ERRORI" -gt 0 ]; then
  echo "[backup] $STAMP TERMINATO CON $(plurale "$ERRORI" ERRORE ERRORI) (totale $DIM in $DEST)" >&2
  exit 1
fi
echo "[backup] $STAMP completato in $DEST (totale $DIM)"
