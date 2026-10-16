// Configurazione Firebase dell'app «Estratti conto → Koinos».
// Incolla qui i valori di Console Firebase › Impostazioni progetto › Le tue app › Configurazione SDK.
// Finché apiKey è vuota, l'app salva i dati nel browser (oppure usa la configurazione
// incollata dalla finestra «Archivio dati» dell'app).
window.FIREBASE_CONFIG = {
  // Solo gli account email con questo dominio possono accedere. Deve coincidere con firestore.rules.
  dominio: 'emvas.tax',
  config: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },
};
