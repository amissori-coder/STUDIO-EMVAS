#!/bin/bash
# Funzioni condivise dagli script di deploy (backup, ripristino, verifica). Si include con
#   source "$(dirname "$0")/comune.sh"
# e richiede che APP_DIR sia già impostata.

# Legge una variabile dal file .env senza eseguirlo (toglie le virgolette).
leggi_env() {
  local chiave="$1"
  [ -f "$APP_DIR/.env" ] || return 1
  sed -n "s/^${chiave}=//p" "$APP_DIR/.env" | tail -1 | sed 's/^"//; s/"$//; s/^'"'"'//; s/'"'"'$//'
}

# Cartella dei documenti dei clienti, la stessa che docker-compose.yml monta nell'applicazione:
# UPLOADS_PATH (dall'ambiente o dal .env) se impostata, altrimenti data/uploads.
cartella_documenti() {
  local percorso="${UPLOADS_PATH:-}"
  [ -n "$percorso" ] || percorso="$(leggi_env UPLOADS_PATH 2>/dev/null || true)"
  if [ -z "$percorso" ]; then
    echo "$APP_DIR/data/uploads"
  elif [ "${percorso#/}" != "$percorso" ]; then
    echo "$percorso"
  else
    # percorso relativo: in docker-compose è relativo alla cartella dell'applicazione
    echo "$APP_DIR/${percorso#./}"
  fi
}

# plurale 1 documento documenti -> "1 documento";  plurale 3 documento documenti -> "3 documenti"
plurale() {
  if [ "$1" = "1" ]; then echo "1 $2"; else echo "$1 $3"; fi
}

# Durata leggibile a partire da un numero di ore: "5 ore", "1 giorno", "3 settimane", "2 mesi".
durata() {
  local ore="$1"
  if [ "$ore" -lt 1 ]; then echo "meno di un'ora"
  elif [ "$ore" -lt 48 ]; then plurale "$ore" ora ore
  elif [ "$ore" -lt 336 ]; then plurale $((ore / 24)) giorno giorni
  elif [ "$ore" -lt 1440 ]; then plurale $((ore / 168)) settimana settimane
  else plurale $((ore / 720)) mese mesi
  fi
}
