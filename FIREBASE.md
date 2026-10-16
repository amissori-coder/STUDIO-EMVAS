# Database Firebase per «Estratti conto → Koinos»

Con Firebase l'archivio (società, conti correnti, periodi, regole, modelli Koinos)
sta in un database Firestore dello studio. Lo vedono tutti gli utenti con un'email
@emvas.tax, da qualsiasi computer. L'app si apre da un indirizzo web su Firebase Hosting.

## 1. Crea il progetto (una volta, circa 10 minuti)

1. Vai su <https://console.firebase.google.com> con l'account Google dello studio
   e crea un progetto, per esempio `emvas-estratti-conto`. Google Analytics non serve.
2. **Firestore Database** › Crea database:
   - modalità **produzione**;
   - località in Europa, per esempio `eur3` oppure `europe-west8` (Milano).

   Contiene movimenti bancari dei clienti: tienilo nell'UE.
3. **Authentication** › Inizia › Metodo di accesso. Attiva:
   - **Google**;
   - **Email/password** con l'opzione **Link via email (accesso senza password)**.

   Questa seconda opzione serve se le caselle @emvas.tax non sono account Google.
4. **Impostazioni progetto** › Le tue app › aggiungi un'app **Web** (icona `</>`).
   Copia l'oggetto `firebaseConfig` e incollalo in `app/firebase-config.js`.
   Lascia `dominio: 'emvas.tax'`.

## 2. Pubblica l'app con GitHub (senza comandi)

L'app si pubblica da sola su GitHub Pages a ogni modifica del branch `main`
(workflow `.github/workflows/pages.yml`). L'indirizzo è:
**https://amissori-coder.github.io/STUDIO-EMVAS/**

Da fare una volta sola:

1. **GitHub** › repository › **Settings › Pages** › Source: **GitHub Actions**.
2. **Firebase** › Authentication › **Impostazioni › Domini autorizzati** ›
   aggiungi `amissori-coder.github.io`.
3. **Firebase** › Firestore Database › **Regole**: incolla il contenuto di
   `firestore.rules` e clicca **Pubblica**.

La prima pubblicazione parte quando il codice arriva su `main`. Puoi anche avviarla
a mano da GitHub › **Actions** › «Pubblica app su GitHub Pages» › **Run workflow**.

Il repository è pubblico: chiunque può leggere il codice e la configurazione
Firebase, che non è un segreto. I dati non stanno su GitHub: sono in Firestore,
protetti dalle regole e dall'accesso riservato agli account @emvas.tax.

## 2-bis. In alternativa: Firebase Hosting (da riga di comando)

Da un computer con Node.js:

```
npm install -g firebase-tools
firebase login
firebase use --add          # scegli il progetto creato
node app/build.mjs
firebase deploy             # pubblica l'app (Hosting) e le regole di sicurezza (firestore.rules)
```

Al termine Firebase mostra l'indirizzo dell'app, per esempio
`https://emvas-estratti-conto.web.app`. Gli indirizzi `*.web.app` e
`*.firebaseapp.com` sono già autorizzati per l'accesso. Un dominio vostro va
aggiunto in Authentication › Impostazioni › Domini autorizzati.

## 3. Primo accesso e trasferimento dei dati

- Apri l'indirizzo e accedi con Google oppure con il link via email. Gli account con
  dominio diverso da @emvas.tax vengono respinti sia dall'app sia dalle regole del database.
- Dati lavorati nella pagina su claude.ai: lì usa «Scarica backup», qui «Ripristina backup».
- Dati salvati nel browser di questo computer (app aperta in locale): clicca l'indicatore
  dell'archivio in alto, poi «Copia su Firebase i dati salvati in questo browser».

## Note

- **Regole di sicurezza** (`firestore.rules`): leggono e scrivono solo gli utenti
  autenticati con email verificata @emvas.tax. Per cambiare dominio modifica sia
  `firestore.rules` sia `dominio` in `app/firebase-config.js`, poi rifai `firebase deploy`.
- **La pagina su claude.ai non si collega a Firebase**: le pagine pubblicate lì possono
  usare solo il loro archivio interno. Per Firebase usa l'indirizzo di Firebase Hosting.
- **Costi**: con un piano gratuito (Spark) i limiti giornalieri di Firestore (50.000
  letture, 20.000 scritture, 1 GB) sono ampiamente sufficienti per uno studio.
- **Più persone sullo stesso periodo**: vale l'ultimo salvataggio. Conviene che ogni
  periodo sia lavorato da una persona alla volta.
- **Backup**: fai comunque «Scarica backup» periodicamente.
