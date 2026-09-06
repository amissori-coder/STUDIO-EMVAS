# Guida all'uso – Studio EMVAS

Questa guida descrive come lo studio e i clienti usano la piattaforma. Per l'installazione e la
configurazione tecnica vedi il [README](../README.md).

## 1. Accesso e installazione sul telefono

- Vai all'indirizzo dell'app e accedi con email e password (oppure con **Accedi con Google** se abilitato
  per lo staff).
- **Android (Chrome)**: menu ⋮ → *Installa app* / *Aggiungi a schermata Home*.
- **iPhone/iPad (Safari)**: pulsante *Condividi* → *Aggiungi alla schermata Home*. Le notifiche push su iOS
  funzionano solo se l'app è stata aggiunta alla schermata Home.
- Dopo l'installazione, da **Impostazioni → Notifiche** premi *Attiva notifiche su questo dispositivo*.

## 2. Ruoli

| Ruolo | Cosa può fare |
| --- | --- |
| Amministratore | tutto: gestione collaboratori, approvazione assenze, catalogo adempimenti, eliminazioni |
| Collaboratore | clienti, attività, email, chat, documenti, richiesta assenze, impostazioni personali |
| Cliente | solo il portale: vede le proprie cartelle e carica documenti |

## 3. Clienti

1. **Clienti → Nuovo cliente**: inserisci denominazione, tipo di soggetto (ditta individuale, S.r.l., professionista…),
   regime fiscale (ordinario, semplificato, forfettario, privato), periodicità IVA, se ha dipendenti, P.IVA/CF, codice
   ATECO, recapiti (email e PEC servono per associare automaticamente le email), referente di studio.
2. Alla creazione vengono predisposte le **cartelle documenti** standard (fatture di vendita/acquisto, corrispettivi,
   estratti conto, F24, buste paga, documenti societari, dichiarazioni, contratti, altro).
3. Nella scheda cliente trovi le sezioni **Anagrafica**, **Attività**, **Email**, **Chat**, **Documenti**.
4. In *Anagrafica → Accesso al portale clienti* crei le credenziali con cui il cliente entra nel portale.
   Comunica al cliente email e password iniziale.

## 4. Adempimenti e pianificazione

- **Adempimenti** contiene il catalogo delle scadenze fiscali (IVA, LIPE, dichiarazioni, CU/770, contributi INPS,
  bilancio, diritto camerale, IMU…) con le regole di applicabilità: regime, tipo di soggetto, periodicità IVA,
  presenza di dipendenti. Gli amministratori possono modificare date, regole e preavvisi o aggiungere nuovi adempimenti.
- Alcuni adempimenti sono **"solo su richiesta"** (es. IMU, Intrastat): vengono generati per un cliente solo se li
  attivi nella sua scheda.
- **Pianificare un cliente**: scheda cliente → *Attività* → *Pianificazione adempimenti*: scegli l'anno, controlla
  l'anteprima (quali adempimenti verranno generati, con quante scadenze), attiva/disattiva singoli adempimenti per quel
  cliente e premi *Genera attività*. Le scadenze che cadono di sabato, domenica o festivo sono spostate al primo giorno
  lavorativo. La generazione è sicura da ripetere: non crea doppioni.
- **Pianificazione massiva**: da *Adempimenti* puoi generare l'intero anno per tutti i clienti attivi in un colpo solo.
- Le attività generate sono assegnate al referente del cliente e possono essere riassegnate.

## 5. Attività e scadenzario

- **Attività** elenca le scadenze (generate o create a mano) con filtri per stato, assegnatario, cliente, periodo.
  Da ogni riga puoi *Completare*, *Prendere in carico* o aprire il dettaglio.
- **Nuova attività** per compiti non a catalogo (es. "Predisporre contratto di locazione").
- Nel dettaglio: stato, priorità, scadenza, assegnatario, note interne, email e documenti collegati.
- **Scadenzario** mostra il calendario mensile con le scadenze e le assenze del team.
- **Promemoria automatici**: ogni mattina l'assegnatario riceve una notifica quando una scadenza si avvicina
  (secondo i giorni di preavviso), il giorno prima, il giorno stesso e quando è scaduta.

## 6. Email da Gmail

1. Ogni collaboratore collega la propria casella da **Impostazioni → Gmail → Collega Gmail** (autorizzazione Google in
   sola lettura). La posta viene sincronizzata ogni 10 minuti e con il pulsante *Sincronizza ora*.
2. In **Email** compaiono i messaggi di tutte le caselle collegate. Quelli provenienti da (o inviati a) un indirizzo
   email/PEC del cliente o di un suo contatto vengono **associati automaticamente** al cliente e il referente riceve una
   notifica.
3. Per gli altri: apri il messaggio e usa *Associa a cliente* (e, se vuoi, a un'attività). Da un'email puoi anche
   *Creare un'attività* già compilata e *Salvare gli allegati* nella cartella documenti del cliente.
4. *Archivia* le email che non richiedono azione. *Apri in Gmail* porta al messaggio originale per rispondere.

## 7. Chat interna per cliente

- **Chat** apre la conversazione interna dello studio relativa a un cliente (i clienti non la vedono).
- Scrivi `@Nome` per menzionare un collaboratore: riceve una notifica. Il referente del cliente viene sempre avvisato
  dei nuovi messaggi.
- La chat è disponibile anche dentro la scheda cliente, sezione *Chat*.

## 8. Team, assenze e allerte

- **Team** mostra i collaboratori; gli amministratori invitano nuovi collaboratori (link di invito) e gestiscono
  ruoli e disattivazioni.
- **Team → Assenze**: ogni collaboratore richiede ferie, permessi o malattia; l'amministratore approva o rifiuta
  (con notifica). Il calendario mostra chi è assente.
- **Allerta assenze**: quando un collaboratore è assente e ha attività in scadenza, la dashboard lo evidenzia e ogni
  mattina gli amministratori ricevono una notifica con l'elenco delle attività da riassegnare (link diretto al filtro
  "attività di X").

## 9. Notifiche

- Campanella in alto: contatore delle notifiche non lette; **Notifiche** elenca tutto (attività assegnate, scadenze,
  chat, email da clienti, documenti caricati, assenze).
- Canali: in-app, push sul telefono/computer (da attivare per ogni dispositivo) e, se configurato, email per gli avvisi
  più importanti. Le preferenze sono in **Impostazioni → Notifiche**.

## 10. Portale clienti

- Il cliente accede con le credenziali fornite dallo studio e vede solo le cartelle a lui visibili.
- Dentro una cartella può caricare file (anche fotografando un documento dal telefono) e scaricare quelli già presenti.
  Lo studio riceve una notifica a ogni caricamento.
- Lo studio, dalla scheda cliente → *Documenti*, gestisce le cartelle (crea, rinomina, nasconde al cliente, blocca il
  caricamento), carica e scarica file, collega documenti a email e attività.

## 11. Consigli operativi

- A inizio anno esegui la **pianificazione massiva** e poi controlla i clienti particolari (IMU, Intrastat…).
- Tieni aggiornati email/PEC dei clienti e dei loro contatti: è ciò che permette l'associazione automatica delle email.
- Fai il backup periodico della cartella `data/` (database e documenti).
