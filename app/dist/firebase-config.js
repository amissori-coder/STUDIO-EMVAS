// Configurazione Firebase dell'app «Estratti conto → Koinos».
// Incolla qui i valori di Console Firebase › Impostazioni progetto › Le tue app › Configurazione SDK.
// Finché apiKey è vuota, l'app salva i dati nel browser (oppure usa la configurazione
// incollata dalla finestra «Archivio dati» dell'app).
window.FIREBASE_CONFIG = {
  // Solo gli account email con questo dominio possono accedere. Deve coincidere con firestore.rules.
  dominio: 'emvas.tax',
  config: {
    apiKey: 'AIzaSyABz4w_9TaXTxFxkup5ZLoEEUETz3RqGHw',
    authDomain: 'emvas-estratti-conto.firebaseapp.com',
    projectId: 'emvas-estratti-conto',
    storageBucket: 'emvas-estratti-conto.firebasestorage.app',
    messagingSenderId: '961639223874',
    appId: '1:961639223874:web:a21837dc3735dcaeb453db',
  },
};
