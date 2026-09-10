# Installazione in produzione, passo per passo

Guida per mettere online Studio EMVAS su un server dedicato, dall'acquisto al primo accesso.
Serve circa un'ora la prima volta. Non occorre essere tecnici: ogni comando va copiato e incollato
così com'è, sostituendo solo i valori indicati in **grassetto**.

Al termine avrai:

- l'applicazione raggiungibile da computer e telefono su un indirizzo tipo `https://studio.emvas.tax`;
- il certificato HTTPS richiesto e rinnovato automaticamente;
- il backup notturno del database e dei documenti;
- gli aggiornamenti di sicurezza del sistema operativo automatici.

---

## 1. Che cosa serve prima di iniziare

| Cosa | Note |
| --- | --- |
| Una carta di credito | Il server si paga a consumo, circa 15 euro al mese |
| Il dominio dello studio | Basta poter aggiungere un record DNS, ad esempio su `emvas.tax` |
| Accesso al repository su GitHub | Per scaricare il codice sul server |
| Un terminale | Su Mac l'app Terminale, su Windows PowerShell |

### La chiave di accesso al server

Sul tuo computer, apri il terminale ed esegui:

```bash
ssh-keygen -t ed25519 -C "studio-emvas"
```

Premi Invio tre volte per accettare i valori proposti. Poi mostra la chiave pubblica:

```bash
cat ~/.ssh/id_ed25519.pub
```

Copia la riga che inizia con `ssh-ed25519`: ti servirà al punto 2. Se il comando dice che il file
esiste già, hai già una chiave e puoi usare quella.

---

## 2. Acquisto del server

Ti servono, con qualunque fornitore: **Ubuntu 24.04**, almeno **2 processori e 4 GB di memoria**, un
**secondo disco per i documenti** che si possa ampliare, e la tua chiave pubblica caricata.

Sotto trovi due fornitori adatti. Se per lo studio conta avere i dati e la fattura in Italia, scegli
la prima opzione. Il resto della guida è identico nei due casi.

### Opzione A: Aruba Cloud, datacenter in Italia

La scelta consigliata se preferisci un fornitore italiano: datacenter a Ponte San Pietro in provincia
di Bergamo, ad Arezzo e a Roma, fattura italiana con IVA e assistenza in italiano.

Registrati su [cloud.it](https://www.cloud.it), vai nella sezione VPS e imposta:

| Voce | Valore |
| --- | --- |
| Piano | Cloud VPS **O2A4**, 2 processori, 4 GB di memoria, 40 GB NVMe |
| Hypervisor | OpenStack |
| Sistema operativo | Ubuntu 24.04 |
| Datacenter | Italia |
| Chiave SSH | Incolla la chiave pubblica copiata al punto 1 |
| Disco aggiuntivo | Crea un volume di block storage da **100 GB** e collegalo al server |

Il piano O2A4 costa circa 9,21 euro al mese più IVA. **Verifica il prezzo del volume da 100 GB prima
di confermare l'ordine**: non sono riuscito a leggerlo da qui e incide sul totale.

### Opzione B: Hetzner Cloud, datacenter in Germania

Più economico a parità di risorse e con un pannello più semplice, ma fornitore tedesco. I dati
restano comunque nell'Unione Europea. Registrati su
[console.hetzner.cloud](https://console.hetzner.cloud). La verifica dell'account può richiedere
qualche ora la prima volta.

Crea un progetto chiamato `Studio EMVAS`, poi premi **Add Server** e imposta:

| Voce | Valore |
| --- | --- |
| Location | Falkenstein oppure Norimberga |
| Image | Ubuntu 24.04 |
| Type | Shared vCPU, scheda CPX, piano **CPX21** |
| Volumes | Aggiungi un volume da **100 GB**, nome `documenti` |
| Networking | Lascia attivi IPv4 e IPv6 |
| SSH Keys | Incolla la chiave pubblica copiata al punto 1 |
| Backups | **Attiva** la casella |
| Name | `studio-emvas` |

### Opzione C: OVHcloud, datacenter a Milano

Anche OVH ha un datacenter in Italia, a Milano, dove i VPS sono disponibili in singola zona di
disponibilità. Fattura e assistenza sono italiane, il traffico è illimitato e il backup giornaliero
è incluso nel pannello.

C'è però una differenza che conta per noi: **il disco aggiuntivo di OVH arriva al massimo a 100 GB**,
cioè si ferma esattamente dove il nostro volume comincia. Con OVH conviene quindi la strategia
opposta: prendere un piano con un disco di sistema abbondante, che nella gamma arriva fino a 640 GB
NVMe, e non aggiungere nessun secondo disco.

| Voce | Valore |
| --- | --- |
| Gamma | Un piano con almeno **2 vCore, 4 GB di memoria e 160 GB di disco** |
| Datacenter | Milano |
| Sistema operativo | Ubuntu 24.04 |
| Chiave SSH | Incolla la chiave pubblica copiata al punto 1 |
| Disco aggiuntivo | Nessuno |

Verifica il prezzo nel configuratore di OVH: non sono riuscito a leggerlo da qui perché i loro siti
sono irraggiungibili da questo ambiente.

### Come scegliere

| | Aruba Cloud | OVHcloud | Hetzner Cloud |
| --- | --- | --- | --- |
| Sede dei dati | Italia | Italia, Milano | Germania o Finlandia |
| Fattura | italiana con IVA | italiana con IVA | tedesca in inversione contabile |
| Assistenza | in italiano | in italiano | in inglese e tedesco |
| Come cresce lo spazio | volume ampliabile senza limiti pratici | cambio di piano, disco fino a 640 GB | volume ampliabile senza limiti pratici |
| Disco aggiuntivo | block storage | massimo 100 GB | volume, circa 4,4 euro per 100 GB |
| Backup dell'intero server | snapshot a pagamento | giornaliero incluso | circa il venti per cento del canone |

Il GDPR non impone di tenere i dati in Italia: basta che restino nell'Unione Europea, e vale per
entrambi. Avere i server in Italia semplifica però il registro dei trattamenti e le domande dei
clienti, e la fattura italiana entra in contabilità senza inversione contabile.

Al termine dell'acquisto, con qualunque fornitore, annota l'indirizzo IP del server: una sequenza di
numeri come `95.217.14.203`. Lo chiameremo **INDIRIZZO-IP**.

### Quanto durerà lo spazio

L'applicazione in esercizio usa meno di 300 MB di memoria, quindi il vincolo vero non è il server ma
lo spazio per i documenti dei clienti. Per questo stanno su un volume separato: si amplia in pochi
minuti senza spegnere niente, mentre il disco del sistema si ingrandisce solo cambiando piano.

Ci sono due modi di affrontarlo, entrambi supportati dall'applicazione:

- **Disco separato**: i documenti stanno su un volume che si amplia in pochi minuti senza spegnere
  niente. È la strada di Aruba e Hetzner. Si imposta `UPLOADS_PATH` nel file di configurazione.
- **Disco di sistema abbondante**: nessun secondo disco, i documenti stanno insieme al resto e per
  crescere si cambia piano. È la strada di OVH. Si lascia `UPLOADS_PATH` vuoto e si salta la parte
  del punto 4 che prepara il volume.

| Come caricano i clienti | 40 clienti | 80 clienti | 150 clienti |
| --- | --- | --- | --- |
| Documenti scansionati in PDF | 11 GB all'anno | 22 GB all'anno | 42 GB all'anno |
| Misto PDF e foto da telefono | 35 GB all'anno | 70 GB all'anno | 132 GB all'anno |
| Prevalenza foto da telefono | 70 GB all'anno | 141 GB all'anno | 264 GB all'anno |

Il backup notturno ti avvisa nel registro quando il disco supera l'ottanta per cento.

### Costo mensile indicativo

| Voce | Costo |
| --- | --- |
| Server con 2 processori e 4 GB di memoria | circa 9 euro |
| Volume da 100 GB per i documenti | da 4 a 15 euro secondo il fornitore |
| Backup automatici del server | circa 2 euro |
| **Totale** | **tra 15 e 26 euro** |

I prezzi sono al netto dell'IVA e vanno verificati al momento dell'acquisto.

---

## 3. Il nome a dominio

Entra nel pannello dove gestisci il dominio dello studio e aggiungi un record:

| Campo | Valore |
| --- | --- |
| Tipo | A |
| Nome | `studio` |
| Valore | **INDIRIZZO-IP** |
| TTL | 3600 |

Se il pannello offre anche il record AAAA, aggiungilo con l'indirizzo IPv6 del server.

La propagazione richiede da pochi minuti a un'ora. Verifica dal tuo computer:

```bash
ping studio.emvas.tax
```

Quando risponde con l'indirizzo del server, puoi proseguire.

---

## 4. Preparazione del server

Collegati al server dal tuo computer:

```bash
ssh root@INDIRIZZO-IP
```

Alla prima connessione scrivi `yes` per accettare l'identità del server. Da qui in avanti tutti i
comandi si eseguono dentro questa finestra.

### Il disco dei documenti

**Se hai scelto un piano con un solo disco abbondante, salta questa sezione** e vai avanti: i
documenti staranno insieme al resto e nel file di configurazione lascerai `UPLOADS_PATH` vuoto.

Altrimenti prepara il volume acquistato al punto 2. Questo comando elenca i dischi:

```bash
lsblk -o NAME,SIZE,TYPE,MOUNTPOINT
```

Cerca il disco da 100 GB senza punto di mount: si chiama `sdb` oppure `vdb` secondo il fornitore. Il
disco del sistema, quello con le partizioni già montate su `/`, non va toccato.

Sostituisci **NOME-DISCO** con il nome che hai trovato ed esegui:

```bash
mkfs.ext4 -F /dev/NOME-DISCO
mkdir -p /mnt/documenti
echo "UUID=$(blkid -s UUID -o value /dev/NOME-DISCO) /mnt/documenti ext4 discard,nofail,defaults 0 0" >> /etc/fstab
mount /mnt/documenti
df -h /mnt/documenti
```

L'ultimo comando deve mostrare circa 98 GB disponibili. Il riferimento all'UUID invece che al nome
del disco fa sì che il volume resti montato anche se il fornitore cambia l'ordine dei dischi a un
riavvio.

> Attenzione: `mkfs.ext4` cancella il contenuto del disco indicato. Esegui il comando solo sul volume
> nuovo e vuoto, mai sul disco del sistema.

### Sistema, Docker, firewall e backup

Scarica il progetto ed esegui lo script di preparazione:

```bash
apt-get update && apt-get install -y git
git clone -b claude/client-compliance-platform-k8wnao https://github.com/amissori-coder/STUDIO-EMVAS.git /opt/studio-emvas
cd /opt/studio-emvas
bash deploy/prepara-server.sh
```

Il codice si trova sul ramo `claude/client-compliance-platform-k8wnao`, indicato qui sopra dopo
l'opzione `-b`. Se in seguito lo unisci nel ramo principale, sostituisci quella parte con `-b main`.

Se il repository è privato, GitHub chiede utente e password: usa il tuo nome utente e un token
personale creato in GitHub alla voce Settings, Developer settings, Personal access tokens, con il
solo permesso di lettura sul repository.

Lo script installa gli aggiornamenti, Docker, il firewall e programma il backup notturno alle 3:15.
Dura qualche minuto e termina con il messaggio `Server pronto`.

---

## 5. Configurazione dell'applicazione

Genera le chiavi delle notifiche push:

```bash
docker run --rm node:22-bookworm-slim sh -c "npm i -s web-push >/dev/null 2>&1 && node -e \"const k=require('web-push').generateVAPIDKeys();console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY='+k.publicKey);console.log('VAPID_PRIVATE_KEY='+k.privateKey)\""
```

Stampa due righe: tienile da parte. Poi genera il segreto delle sessioni:

```bash
openssl rand -base64 32
```

Ora crea il file di configurazione:

```bash
cd /opt/studio-emvas
cp .env.example .env
nano .env
```

Si apre un editor di testo. Modifica queste voci, lasciando il resto com'è:

```
DOMINIO=studio.emvas.tax
UPLOADS_PATH=/mnt/documenti
APP_URL=https://studio.emvas.tax
SESSION_SECRET=il-segreto-generato-con-openssl
ADMIN_EMAIL=a.missori@emvas.tax
ADMIN_NOME=Nome Cognome
ADMIN_PASSWORD=una-password-lunga-che-cambierai-al-primo-accesso
NEXT_PUBLIC_VAPID_PUBLIC_KEY=la-prima-riga-generata-sopra
VAPID_PRIVATE_KEY=la-seconda-riga-generata-sopra
```

Se non hai un disco separato per i documenti, lascia `UPLOADS_PATH` vuoto: finiranno in
`/opt/studio-emvas/data/uploads` insieme al resto.

Salva con `Ctrl+O`, Invio, poi esci con `Ctrl+X`.

Metti al sicuro il file, che contiene i segreti:

```bash
chmod 600 .env
```

---

## 6. Avvio

```bash
cd /opt/studio-emvas
docker compose up -d --build
```

La prima compilazione richiede tra i cinque e i dieci minuti. Al termine controlla lo stato:

```bash
docker compose ps
docker compose logs app --tail 30
```

Nel registro devi vedere `Ready` e la riga del pianificatore interno. Apri il browser su
`https://studio.emvas.tax`: il certificato HTTPS viene richiesto automaticamente al primo accesso e
la prima apertura può metterci una decina di secondi.

Accedi con l'email e la password che hai messo in `ADMIN_EMAIL` e `ADMIN_PASSWORD`.

### Verifica dell'installazione

Questo comando controlla venti aspetti dell'installazione e dice cosa manca:

```bash
bash /opt/studio-emvas/deploy/verifica.sh
```

Controlla Docker e il firewall, la configurazione e i segreti, i due servizi in esecuzione, la
risposta dell'applicazione, il nome a dominio e il certificato HTTPS, lo spazio sui dischi,
l'integrità del database e lo stato dei backup. Rieseguilo ogni volta che cambi qualcosa o se
qualcosa non va: è solo lettura, non modifica niente.

---

## 7. Prime cose da fare nell'applicazione

1. **Cambia la password** in Impostazioni, sezione Password. Questa operazione chiude le sessioni
   aperte altrove, come previsto.
2. **Installa l'app sul telefono**: apri l'indirizzo con Chrome su Android o Safari su iPhone e scegli
   Aggiungi alla schermata Home. Su iPhone è obbligatorio per ricevere le notifiche.
3. **Attiva le notifiche** su ogni dispositivo da Impostazioni, sezione Notifiche.
4. **Invita i collaboratori** da Team: ognuno riceve un link per scegliere la propria password.
5. **Inserisci i clienti** con email e PEC corrette: sono ciò che permette di associare
   automaticamente la posta in arrivo.
6. **Pianifica le scadenze** da Adempimenti, riquadro Pianificazione massiva, scegliendo l'anno.
7. **Crea gli accessi al portale** per i clienti che devono caricare documenti, dalla scheda del
   cliente, sezione Accesso al portale clienti.

---

## 8. Collegare Gmail

Serve una configurazione una tantum su Google, poi ogni collaboratore collega la propria casella.

1. Vai su [console.cloud.google.com](https://console.cloud.google.com) e crea un progetto chiamato
   `Studio EMVAS`.
2. Nella libreria delle API abilita **Gmail API**.
3. Configura la schermata di consenso OAuth. Se lo studio usa Google Workspace scegli il tipo
   Interno, altrimenti Esterno aggiungendo gli indirizzi dei collaboratori come utenti di test.
4. Crea credenziali di tipo **ID client OAuth**, applicazione web, con URI di reindirizzamento
   autorizzato esattamente questo:

   ```
   https://studio.emvas.tax/api/auth/google/callback
   ```

5. Copia l'ID client e il segreto nel file `.env` del server, alle voci `GOOGLE_CLIENT_ID` e
   `GOOGLE_CLIENT_SECRET`, poi riavvia:

   ```bash
   cd /opt/studio-emvas && nano .env && docker compose restart app
   ```

6. Ogni collaboratore entra in Impostazioni, sezione Gmail, e preme Collega Gmail.

La posta viene letta e basta: l'applicazione non invia mai email dalla casella collegata. La casella
importata è però visibile a tutto lo staff, quindi collega solo caselle di lavoro.

---

## 9. Notifiche via email (facoltativo)

Per ricevere anche per email gli avvisi più importanti, compila nel `.env` le voci `SMTP_HOST`,
`SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `SMTP_FROM` con i dati del provider di posta dello studio,
poi riavvia con `docker compose restart app`. Senza questi valori restano attive le notifiche
nell'applicazione e quelle push sul telefono.

---

## 10. Backup

Il backup notturno è già programmato dallo script di preparazione e scrive in
`/var/backups/studio-emvas`:

- una copia integra del database, una per notte, conservata trenta giorni;
- uno specchio aggiornato di tutti i documenti.

Per eseguirlo subito e controllare che funzioni:

```bash
/opt/studio-emvas/deploy/backup.sh
ls -lh /var/backups/studio-emvas/database | tail -5
```

### Copia fuori dal server

Ai backup notturni conviene affiancare una copia che non stia sullo stesso server, così sopravvive
anche a un guasto grave o a una cancellazione per errore.

- **Snapshot del fornitore**: su Hetzner sono i backup automatici che hai attivato all'acquisto, su
  Aruba sono gli snapshot da attivare dal pannello. Fotografano l'intero server e bastano per il caso
  più comune.
- **Spazio di archiviazione remoto**: uno Storage Box di Hetzner oppure un Cloud Object Storage di
  Aruba, entrambi da pochi euro al mese per 1 TB. Aggiungi una riga al file
  `/etc/cron.d/studio-emvas-backup` per copiarci i backup ogni notte:

  ```bash
  rsync -az --delete /var/backups/studio-emvas/ utente@indirizzo-dello-spazio-remoto:backup-emvas/
  ```

- **Una copia in studio**: puoi anche scaricare periodicamente la cartella dei backup su un disco
  esterno dello studio, dal tuo computer:

  ```bash
  rsync -az root@INDIRIZZO-IP:/var/backups/studio-emvas/ ~/backup-emvas/
  ```

### Ripristino

```bash
/opt/studio-emvas/deploy/ripristina.sh /var/backups/studio-emvas/database/emvas-AAAAMMGG-HHMM.db.gz
```

Lo script ferma l'applicazione, conserva il database attuale con un nome che riporta la data,
rimette al suo posto la copia scelta e riavvia.

---

## 11. Aggiornamenti

Per portare sul server una nuova versione:

```bash
cd /opt/studio-emvas
git pull
docker compose up -d --build
```

Il database viene aggiornato da solo all'avvio e i dati restano al loro posto. Conviene lanciare
prima un backup manuale.

Gli aggiornamenti di sicurezza di Ubuntu si installano da soli. Ogni tanto riavvia il server con
`reboot`: l'applicazione riparte automaticamente.

---

## 12. Se qualcosa non va

Il primo comando da provare è sempre questo, che controlla tutto e indica il problema:

```bash
bash /opt/studio-emvas/deploy/verifica.sh
```

| Sintomo | Comando da eseguire sul server | Cosa guardare |
| --- | --- | --- |
| Il sito non si apre | `docker compose ps` | Entrambi i servizi devono risultare avviati |
| Errore del certificato | `docker compose logs proxy --tail 50` | Il record DNS deve puntare al server e le porte 80 e 443 essere libere |
| Pagina di errore | `docker compose logs app --tail 100` | Il messaggio in fondo indica la causa |
| Verifica rapida | `curl -s localhost:3000/api/health` | Deve rispondere `{"ok":true}` |
| Spazio disco | `df -h /mnt/documenti` | Se supera l'ottanta per cento amplia il volume |

### Ampliare il volume dei documenti

Dal pannello del fornitore apri il volume e aumenta la dimensione. Su Aruba la voce è nella gestione
del block storage, su Hetzner è il pulsante Resize. Poi sul server, con **NOME-DISCO** uguale a quello
usato al punto 4:

```bash
resize2fs /dev/NOME-DISCO
df -h /mnt/documenti
```

L'operazione avviene a caldo, senza interrompere il servizio.

### Riavvio completo

```bash
cd /opt/studio-emvas && docker compose restart
```

---

## Riepilogo dei percorsi

| Cosa | Dove |
| --- | --- |
| Applicazione | `/opt/studio-emvas` |
| Configurazione e segreti | `/opt/studio-emvas/.env` |
| Database | `/opt/studio-emvas/data/emvas.db` |
| Documenti dei clienti | `/mnt/documenti` |
| Backup | `/var/backups/studio-emvas` |
| Registro dei backup | `/var/log/studio-emvas-backup.log` |
