# STUDIO-EMVAS

## Estratti conto → Koinos

Web app per trasformare gli estratti conto bancari delle società clienti nel file
«Importazione da file di testo movimenti» di DATEV Koinos.

Funzioni principali:

- **Più società**: ognuna con i propri dati di base, cioè causali (precaricate dalla
  tabella dello studio), piano dei conti, clienti e fornitori, registri IVA, mastri
  e conto transitorio.
- **Conti correnti**: codice conto banca in Koinos e periodicità mensile o
  trimestrale, scelta anno per anno dal 2026. Gli anni si aggiungono quando servono.
- **Periodi**: carichi l'estratto conto in Excel o CSV, oppure lo incolli da Excel.
  Le colonne della banca vengono memorizzate per ogni conto.
- **Abbinamenti**:
  - le regole apprese abbinano i movimenti noti;
  - i clienti e fornitori riconosciuti nella descrizione vengono proposti, da
    confermare;
  - i movimenti nuovi si abbinano a mano, con la possibilità di salvare una regola
    per i periodi successivi.
- **Excel prima nota cassa banca** (formato predefinito): genera il foglio
  «Movimenti di prima nota» da importare nella Prima nota cassa banca di Koinos.
  Contiene data registrazione, descrizione operazione, importo entrata e uscita,
  con denominazione, codice fiscale e saldi in testata. Se carichi il file vuoto
  creato da Koinos con «Crea file Excel di importazione», l'app lo usa come modello.
  Per incassi e pagamenti abbinati la descrizione segue lo schema di Koinos
  («Incasso cliente Rossi Snc ft 123»).
- **Generazione CSV** (in alternativa): produce le 66 colonne del tracciato. Ogni movimento diventa
  una registrazione di due righe:
  - riga banca con Tipo riga 2;
  - riga di contropartita. Per incassi e pagamenti ha Tipo riga 0, il nominativo,
    la partita `numero|anno` e Scadenze `*`.
- **Riepilogo abbinamenti** per causale e contropartita, con dettaglio ed export
  Excel. A parte c'è l'elenco delle regole, con il numero di utilizzi.
- **Backup e ripristino** di tutto l'archivio in un file JSON.

### Struttura

- `app/src/shell.html`: layout e stile
- `app/src/app.js`: logica dell'applicazione
- `app/src/causali-template.json`: tabella causali dello studio, usata per ogni nuova società
- `app/build.mjs`: assembla i file in `app/dist/`

```
node app/build.mjs
```

Poi apri `app/dist/index.html` nel browser. Per il database condiviso dello studio su Firebase (Firestore, accesso solo @emvas.tax, pubblicazione su Firebase Hosting) segui [FIREBASE.md](FIREBASE.md). In locale i dati restano nel browser
(IndexedDB): fai backup regolari. Pubblicata su claude.ai, la pagina usa
l'archivio online dell'artifact.
