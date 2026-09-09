#!/bin/bash
# Prepara un server Ubuntu 24.04 appena creato per ospitare Studio EMVAS:
# aggiornamenti, Docker, firewall, strumenti di backup e attività notturna.
# Eseguire come root:  bash deploy/prepara-server.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/studio-emvas}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/studio-emvas}"

if [ "$(id -u)" != "0" ]; then
  echo "Esegui questo script come root (sudo bash deploy/prepara-server.sh)" >&2
  exit 1
fi

echo "== 1/5 Aggiornamento del sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq ca-certificates curl git sqlite3 rsync ufw unattended-upgrades

echo "== 2/5 Installazione di Docker"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
docker --version

echo "== 3/5 Firewall"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null
ufw status | head -8

echo "== 4/5 Aggiornamenti di sicurezza automatici"
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true

echo "== 5/5 Backup notturno alle 3:15"
mkdir -p "$APP_DIR" "$BACKUP_DIR"
cat > /etc/cron.d/studio-emvas-backup <<CRON
# Backup notturno di Studio EMVAS
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
15 3 * * * root APP_DIR=$APP_DIR $APP_DIR/deploy/backup.sh $BACKUP_DIR >> /var/log/studio-emvas-backup.log 2>&1
CRON
chmod 0644 /etc/cron.d/studio-emvas-backup

echo
echo "Server pronto."
echo "Cartella applicazione: $APP_DIR"
echo "Cartella backup:       $BACKUP_DIR"
echo "Prosegui con il punto 4 della guida docs/INSTALLAZIONE.md"
