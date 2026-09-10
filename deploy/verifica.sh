#!/bin/bash
# Verifica lo stato di un'installazione di Studio EMVAS.
# Uso, dal server:  bash /opt/studio-emvas/deploy/verifica.sh
# Non modifica nulla: esegue solo controlli e stampa un riepilogo.

# Volutamente senza "set -e": i controlli devono proseguire anche quando uno fallisce.
set -uo pipefail

APP_DIR="${APP_DIR:-/opt/studio-emvas}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/studio-emvas}"

BUONI=0
PROBLEMI=0
AVVISI=0

ok()      { printf '  \033[32m✓\033[0m %s\n' "$1"; BUONI=$((BUONI + 1)); }
errore()  { printf '  \033[31m✗\033[0m %s\n' "$1"; PROBLEMI=$((PROBLEMI + 1)); }
avviso()  { printf '  \033[33m!\033[0m %s\n' "$1"; AVVISI=$((AVVISI + 1)); }
nota()    { printf '    %s\n' "$1"; }
titolo()  { printf '\n\033[1m%s\033[0m\n' "$1"; }

# Legge una variabile dal file .env senza eseguirlo.
leggi_env() {
  local chiave="$1"
  [ -f "$APP_DIR/.env" ] || return 1
  sed -n "s/^${chiave}=//p" "$APP_DIR/.env" | tail -1 | sed 's/^"//; s/"$//; s/^'"'"'//; s/'"'"'$//'
}

printf '\033[1mVerifica di Studio EMVAS\033[0m  (%s)\n' "$(date '+%d/%m/%Y %H:%M')"

# ---------------------------------------------------------------------------
titolo "1. Sistema"

if command -v docker >/dev/null 2>&1; then
  ok "Docker installato: $(docker --version | cut -d, -f1)"
  if docker compose version >/dev/null 2>&1; then
    ok "Docker Compose disponibile"
  else
    errore "Docker Compose non disponibile: rilancia deploy/prepara-server.sh"
  fi
  if systemctl is-active --quiet docker 2>/dev/null; then
    ok "Servizio Docker attivo"
  else
    errore "Servizio Docker non attivo: systemctl start docker"
  fi
else
  errore "Docker non installato: esegui  bash $APP_DIR/deploy/prepara-server.sh"
fi

if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | head -1 | grep -q "active"; then
  ok "Firewall attivo"
  for porta in 80 443; do
    ufw status 2>/dev/null | grep -q "^$porta" || avviso "La porta $porta non risulta aperta nel firewall"
  done
else
  avviso "Firewall non attivo: ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable"
fi

for comando in sqlite3 rsync git; do
  command -v "$comando" >/dev/null 2>&1 || avviso "Manca il comando $comando: apt-get install -y $comando"
done

# ---------------------------------------------------------------------------
titolo "2. Configurazione"

if [ -f "$APP_DIR/.env" ]; then
  ok "File di configurazione presente"
  PERMESSI="$(stat -c '%a' "$APP_DIR/.env" 2>/dev/null)"
  if [ "$PERMESSI" = "600" ]; then
    ok "Permessi del file .env corretti"
  else
    avviso "Il file .env ha permessi $PERMESSI: proteggi i segreti con  chmod 600 $APP_DIR/.env"
  fi

  DOMINIO="$(leggi_env DOMINIO)"
  APP_URL="$(leggi_env APP_URL)"
  SEGRETO="$(leggi_env SESSION_SECRET)"
  UPLOADS="$(leggi_env UPLOADS_PATH)"

  [ -n "${DOMINIO:-}" ] && ok "Dominio: $DOMINIO" || errore "DOMINIO non impostato nel file .env"

  if [ -n "${APP_URL:-}" ]; then
    case "$APP_URL" in
      https://*) ok "Indirizzo pubblico: $APP_URL" ;;
      *) avviso "APP_URL non usa https: le notifiche push e i cookie sicuri non funzioneranno" ;;
    esac
    if [ -n "${DOMINIO:-}" ] && [ "$APP_URL" != "https://$DOMINIO" ]; then
      avviso "APP_URL e DOMINIO non coincidono: atteso https://$DOMINIO"
    fi
  else
    errore "APP_URL non impostato nel file .env"
  fi

  if [ -z "${SEGRETO:-}" ]; then
    errore "SESSION_SECRET non impostato: generane uno con  openssl rand -base64 32"
  elif [ "${#SEGRETO}" -lt 32 ]; then
    errore "SESSION_SECRET troppo corto (${#SEGRETO} caratteri, minimo 32)"
  else
    ok "Segreto delle sessioni impostato"
  fi

  for opzionale in GOOGLE_CLIENT_ID NEXT_PUBLIC_VAPID_PUBLIC_KEY SMTP_HOST; do
    valore="$(leggi_env "$opzionale")"
    case "$opzionale" in
      GOOGLE_CLIENT_ID) etichetta="Collegamento a Gmail" ;;
      NEXT_PUBLIC_VAPID_PUBLIC_KEY) etichetta="Notifiche push" ;;
      *) etichetta="Notifiche via email" ;;
    esac
    [ -n "${valore:-}" ] && ok "$etichetta configurato" || nota "$etichetta non configurato (facoltativo)"
  done
else
  errore "Manca $APP_DIR/.env: copialo da .env.example e compilalo"
  DOMINIO=""; UPLOADS=""
fi

# ---------------------------------------------------------------------------
titolo "3. Applicazione"

if [ -f "$APP_DIR/docker-compose.yml" ] && command -v docker >/dev/null 2>&1; then
  ATTIVI="$(cd "$APP_DIR" && docker compose ps --services --filter status=running 2>/dev/null)"
  for servizio in app proxy; do
    if echo "$ATTIVI" | grep -qx "$servizio"; then
      ok "Servizio $servizio in esecuzione"
    else
      errore "Servizio $servizio non in esecuzione: cd $APP_DIR && docker compose up -d"
    fi
  done

  RISPOSTA="$(curl -s --max-time 10 http://127.0.0.1:3000/api/health 2>/dev/null)"
  if echo "$RISPOSTA" | grep -q '"ok":true'; then
    ok "L'applicazione risponde correttamente sul server"
  else
    errore "L'applicazione non risponde: cd $APP_DIR && docker compose logs app --tail 50"
  fi
else
  errore "Progetto non trovato in $APP_DIR"
fi

# ---------------------------------------------------------------------------
titolo "4. Accesso da internet"

if [ -n "${DOMINIO:-}" ]; then
  IP_DOMINIO="$(getent hosts "$DOMINIO" 2>/dev/null | awk '{print $1}' | head -1)"
  IP_SERVER="$(curl -s --max-time 10 https://api.ipify.org 2>/dev/null)"
  if [ -z "$IP_DOMINIO" ]; then
    errore "Il nome $DOMINIO non si risolve: controlla il record DNS di tipo A"
  elif [ -n "$IP_SERVER" ] && [ "$IP_DOMINIO" != "$IP_SERVER" ]; then
    avviso "Il nome $DOMINIO punta a $IP_DOMINIO ma il server è $IP_SERVER"
  else
    ok "Il nome $DOMINIO punta a questo server"
  fi

  CODICE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://$DOMINIO/api/health" 2>/dev/null)"
  if [ "$CODICE" = "200" ]; then
    ok "Il sito risponde in HTTPS"
  else
    errore "Il sito in HTTPS risponde $CODICE: cd $APP_DIR && docker compose logs proxy --tail 50"
  fi

  SCADENZA="$(echo | timeout 12 openssl s_client -servername "$DOMINIO" -connect "$DOMINIO:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
  if [ -n "$SCADENZA" ]; then
    GIORNI=$(( ( $(date -d "$SCADENZA" +%s 2>/dev/null || echo 0) - $(date +%s) ) / 86400 ))
    if [ "$GIORNI" -gt 20 ]; then
      ok "Certificato HTTPS valido ancora $GIORNI giorni"
    elif [ "$GIORNI" -gt 0 ]; then
      avviso "Certificato HTTPS in scadenza tra $GIORNI giorni: il rinnovo è automatico, ricontrolla domani"
    else
      errore "Certificato HTTPS scaduto o non leggibile"
    fi
  else
    avviso "Non sono riuscito a leggere il certificato HTTPS"
  fi
else
  nota "Nessun dominio configurato: controllo saltato"
fi

# ---------------------------------------------------------------------------
titolo "5. Spazio e dati"

CARTELLA_DOCUMENTI="${UPLOADS:-$APP_DIR/data/uploads}"
[ -n "${UPLOADS:-}" ] || CARTELLA_DOCUMENTI="$APP_DIR/data/uploads"

if [ -n "${UPLOADS:-}" ]; then
  if mountpoint -q "$UPLOADS" 2>/dev/null; then
    ok "Disco dei documenti montato su $UPLOADS"
  else
    errore "$UPLOADS non è un disco montato: i documenti finirebbero sul disco di sistema"
  fi
else
  nota "Documenti sul disco di sistema (UPLOADS_PATH non impostato)"
fi

for percorso in "$APP_DIR/data" "$CARTELLA_DOCUMENTI" "$BACKUP_DIR"; do
  [ -d "$percorso" ] || continue
  USATO="$(df --output=pcent "$percorso" 2>/dev/null | tail -1 | tr -dc '0-9')"
  LIBERO="$(df -h --output=avail "$percorso" 2>/dev/null | tail -1 | tr -d ' ')"
  [ -n "$USATO" ] || continue
  if [ "$USATO" -ge 90 ]; then
    errore "Disco di $percorso pieno al $USATO% (liberi $LIBERO): amplia subito lo spazio"
  elif [ "$USATO" -ge 80 ]; then
    avviso "Disco di $percorso pieno al $USATO% (liberi $LIBERO): pianifica un ampliamento"
  else
    ok "Spazio su $percorso: $USATO% usato, $LIBERO liberi"
  fi
done

if [ -f "$APP_DIR/data/emvas.db" ]; then
  DIM="$(du -h "$APP_DIR/data/emvas.db" | cut -f1)"
  if command -v sqlite3 >/dev/null 2>&1 && [ "$(sqlite3 "$APP_DIR/data/emvas.db" 'PRAGMA quick_check;' 2>/dev/null)" = "ok" ]; then
    CLIENTI="$(sqlite3 "$APP_DIR/data/emvas.db" 'SELECT count(*) FROM Client;' 2>/dev/null)"
    UTENTI="$(sqlite3 "$APP_DIR/data/emvas.db" 'SELECT count(*) FROM User;' 2>/dev/null)"
    ok "Database integro ($DIM, ${CLIENTI:-0} clienti, ${UTENTI:-0} utenti)"
  else
    avviso "Database presente ($DIM) ma non verificabile"
  fi
else
  errore "Database non trovato in $APP_DIR/data/emvas.db"
fi

# ---------------------------------------------------------------------------
titolo "6. Backup"

if [ -f /etc/cron.d/studio-emvas-backup ]; then
  ok "Backup notturno programmato"
else
  errore "Backup notturno non programmato: esegui  bash $APP_DIR/deploy/prepara-server.sh"
fi

ULTIMO="$(ls -1t "$BACKUP_DIR"/database/*.db.gz 2>/dev/null | head -1)"
if [ -n "$ULTIMO" ]; then
  ETA=$(( ( $(date +%s) - $(stat -c %Y "$ULTIMO") ) / 3600 ))
  if [ "$ETA" -le 30 ]; then
    ok "Ultimo backup di $ETA ore fa ($(basename "$ULTIMO"))"
  else
    avviso "Ultimo backup di $ETA ore fa: controlla /var/log/studio-emvas-backup.log"
  fi
  NUMERO="$(ls -1 "$BACKUP_DIR"/database/*.db.gz 2>/dev/null | wc -l)"
  nota "Copie conservate: $NUMERO"
else
  avviso "Nessun backup ancora eseguito: provalo ora con  $APP_DIR/deploy/backup.sh"
fi

# ---------------------------------------------------------------------------
printf '\n\033[1mRiepilogo\033[0m\n'
printf '  %s controlli superati, %s avvisi, %s problemi\n' "$BUONI" "$AVVISI" "$PROBLEMI"
if [ "$PROBLEMI" -gt 0 ]; then
  printf '\n  Risolvi prima i punti contrassegnati con la croce rossa.\n'
  exit 1
fi
if [ "$AVVISI" -gt 0 ]; then
  printf '\n  Tutto funziona. Gli avvisi non bloccano nulla ma conviene sistemarli.\n'
  exit 0
fi
printf '\n  Installazione completa e in salute.\n'
exit 0
