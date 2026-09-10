# Studio EMVAS – Area riservata

Piattaforma web privata per lo studio (accessibile anche da telefono, installabile come app):

- **Clienti**: anagrafica, regime fiscale, attività, contatti, referente di studio.
- **Adempimenti**: catalogo degli adempimenti fiscali italiani con regole di applicabilità
  (regime, tipo soggetto, periodicità IVA, dipendenti); pianificazione annuale per cliente
  con generazione automatica delle scadenze (già spostate al primo giorno lavorativo).
- **Attività e scadenzario**: assegnazione ai collaboratori, stati, priorità, calendario.
- **Email da Gmail**: sincronizzazione delle caselle Google dei collaboratori, associazione
  automatica ai clienti (email/PEC/contatti), collegamento manuale a clienti e attività,
  salvataggio degli allegati tra i documenti del cliente.
- **Chat interna per cliente** con menzioni `@Nome`.
- **Team e assenze**: collaboratori, ferie/permessi/malattia con approvazione.
- **Notifiche**: in-app, push (anche su telefono) ed email; promemoria scadenze; allerta
  quando un collaboratore assente ha attività in scadenza.
- **Portale clienti**: i clienti accedono con le proprie credenziali e caricano i documenti
  nelle cartelle predisposte dallo studio.

## Avvio rapido (sviluppo)

```bash
cp .env.example .env        # poi imposta SESSION_SECRET (openssl rand -base64 32) e ADMIN_PASSWORD
npm install
npm run setup               # crea il database SQLite e carica admin + catalogo adempimenti
npm run db:seed:demo        # (facoltativo) clienti e attività dimostrativi
npm run dev                 # http://localhost:3000
```

Accedi con `ADMIN_EMAIL` / `ADMIN_PASSWORD` del file `.env`. Se `ADMIN_PASSWORD` non è impostata, il seed genera
una password casuale e la stampa una sola volta a console (non esiste una password predefinita).
Con i dati demo: collaboratore `collaboratore@studio.local` / `Collaboratore123!`,
utente portale `cliente@rossi-impianti.it` / `Cliente123!`.

## Configurazione

| Variabile | Descrizione |
| --- | --- |
| `APP_URL` | URL pubblico (es. `https://studio.emvas.tax`), usato nei link delle notifiche e nel callback Google |
| `SESSION_SECRET` | segreto per firmare le sessioni (`openssl rand -base64 32`, almeno 32 caratteri; in produzione il valore di esempio viene rifiutato) |
| `DATA_DIR`, `DATABASE_URL` | cartella dati (database + documenti caricati) |
| `GOOGLE_CLIENT_ID/SECRET` | credenziali OAuth per login staff e lettura Gmail (vedi sotto) |
| `GOOGLE_ALLOWED_DOMAIN` | se impostato, solo account Google di quel dominio possono accedere |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | chiavi per le notifiche push (`npm run vapid`) |
| `SMTP_*` | server SMTP per le notifiche via email (facoltativo) |
| `CRON_SECRET` | per invocare i job da un cron esterno (`/api/cron/daily`, `/api/cron/gmail`), solo via header `Authorization` |

### Google / Gmail
1. Su [Google Cloud Console](https://console.cloud.google.com) crea un progetto e abilita la **Gmail API**.
2. Configura la schermata di consenso OAuth (tipo *Interno* se usi Google Workspace, altrimenti *Esterno* con gli utenti di test).
3. Crea credenziali **OAuth 2.0 – Applicazione web** con URI di reindirizzamento `{APP_URL}/api/auth/google/callback`.
4. Inserisci `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` nel `.env`.
5. Ogni collaboratore collega la propria casella da **Impostazioni → Gmail**. La sincronizzazione avviene ogni 10 minuti
   (e con il pulsante *Sincronizza*).

Le email non vengono mai inviate dall'app: si legge solo la posta (scope `gmail.readonly`).

Nota sulla riservatezza: la posta importata (ultimi `GMAIL_SYNC_DAYS` giorni e poi i nuovi messaggi) forma una
casella unificata visibile a **tutto lo staff**, comprese le email non associate a clienti. Collega quindi solo
caselle di lavoro dello studio, non caselle personali. Ogni casella può essere collegata da un solo utente.

### Notifiche push
Genera le chiavi con `npm run vapid`, inseriscile nel `.env` e riavvia il server (in Docker: `docker compose up -d --build`,
così la chiave pubblica entra anche nel bundle client). Ogni utente attiva le notifiche su ciascun dispositivo da
**Impostazioni → Notifiche**. Su iPhone/iPad occorre prima aggiungere l'app alla schermata Home.

### Job pianificati
Il server esegue internamente (`node-cron`):
- ogni giorno alle 07:30: promemoria scadenze agli assegnatari e allerta agli amministratori per i collaboratori assenti con attività in scadenza;
- ogni 10 minuti: sincronizzazione Gmail.

In alternativa (`ENABLE_CRON=false`) puoi chiamare `GET /api/cron/daily` e `GET /api/cron/gmail` con header
`Authorization: Bearer CRON_SECRET` da un cron esterno (il segreto non è accettato nella query string).
Un amministratore autenticato può eseguirli manualmente solo con `POST` (l'esecuzione viene registrata in audit).

## Produzione con Docker

Guida completa passo per passo, dall'acquisto del server al primo accesso:
[`docs/INSTALLAZIONE.md`](docs/INSTALLAZIONE.md). In sintesi:

```bash
cp .env.example .env   # imposta almeno DOMINIO, APP_URL, SESSION_SECRET e ADMIN_PASSWORD
docker compose up -d --build
```

`docker compose` avvia l'applicazione e un reverse proxy che richiede e rinnova da solo il
certificato HTTPS per il dominio indicato in `DOMINIO`. Impostando `UPLOADS_PATH` i documenti dei
clienti finiscono su un disco separato e ampliabile.

Verifica dell'installazione: `deploy/verifica.sh` (controlla servizi, certificato, spazio, backup).
Backup notturno del database e dei documenti: `deploy/backup.sh`, installato nel cron da
`deploy/prepara-server.sh`. Ripristino: `deploy/ripristina.sh <file-di-backup>`.
Il database e i documenti stanno nella cartella `./data`, oppure in `UPLOADS_PATH` per i documenti.

## Comandi utili

```bash
npm run typecheck   # controllo tipi
npm run lint        # eslint
npm run build       # build di produzione
npm run test:unit   # test unitari (calendario fiscale, regole adempimenti, parsing Gmail, sicurezza)
npm run test:e2e    # smoke test con browser su tutte le pagine (richiede server avviato e dati demo, BASE_URL)
npm run test:e2e:flussi  # flussi chiave: filtri scadenze, invalidazione sessioni, upload/download dal portale
npm run db:studio   # Prisma Studio per ispezionare i dati
```

Documentazione tecnica: [`docs/ARCHITETTURA.md`](docs/ARCHITETTURA.md).
