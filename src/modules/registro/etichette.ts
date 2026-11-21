import type { BadgeColor } from "@/components/ui/Badge";
import { PRIORITA_TASK, RUOLI, STATI_ASSENZA, STATI_TASK, TIPI_ASSENZA } from "@/lib/constants";

/**
 * Etichette italiane del registro delle operazioni. Modulo puro: tests/unit/registro.test.ts legge le
 * chiamate ad audit() in tutto src/ e verifica che ogni operazione registrata abbia qui la sua
 * etichetta, così una nuova operazione non compare mai a schermo come sigla tecnica.
 */

export const GRUPPI = {
  accessi: "Accessi",
  clienti: "Clienti e portale",
  attivita: "Attività e adempimenti",
  documenti: "Documenti",
  email: "Email",
  collaboratori: "Collaboratori e assenze",
  sistema: "Sistema",
} as const;
export type Gruppo = keyof typeof GRUPPI;

export interface DescrizioneAzione {
  label: string;
  gruppo: Gruppo;
  colore: BadgeColor;
}

export const AZIONI: Record<string, DescrizioneAzione> = {
  // Accessi e profilo
  LOGIN: { label: "Accesso effettuato", gruppo: "accessi", colore: "slate" },
  LOGIN_GOOGLE: { label: "Accesso effettuato con Google", gruppo: "accessi", colore: "slate" },
  LOGIN_FALLITO: { label: "Accesso non riuscito", gruppo: "accessi", colore: "yellow" },
  LOGIN_BLOCCATO: { label: "Accesso bloccato per troppi tentativi", gruppo: "accessi", colore: "red" },
  PASSWORD_CAMBIATA: { label: "Password cambiata", gruppo: "accessi", colore: "orange" },
  PREFERENZE_NOTIFICHE: { label: "Preferenze di avviso modificate", gruppo: "accessi", colore: "slate" },
  PROFILO_MODIFICATO: { label: "Profilo modificato", gruppo: "accessi", colore: "blue" },
  INVITO_ACCETTATO: { label: "Invito accettato", gruppo: "accessi", colore: "green" },
  LOGIN_ATTESA_CODICE: { label: "Password corretta, in attesa del codice", gruppo: "accessi", colore: "slate" },
  LOGIN_CON_CODICE: { label: "Accesso effettuato con il codice", gruppo: "accessi", colore: "slate" },
  LOGIN_CON_CODICE_RECUPERO: { label: "Accesso con un codice di recupero", gruppo: "accessi", colore: "orange" },
  CODICE_FALLITO: { label: "Codice di verifica errato", gruppo: "accessi", colore: "yellow" },
  CODICE_RECUPERO_FALLITO: { label: "Codice di recupero errato", gruppo: "accessi", colore: "yellow" },
  CODICE_BLOCCATO: { label: "Codice bloccato per troppi tentativi", gruppo: "accessi", colore: "red" },
  TOTP_ATTIVATA: { label: "Verifica in due passaggi attivata", gruppo: "accessi", colore: "green" },
  TOTP_DISATTIVATA: { label: "Verifica in due passaggi disattivata", gruppo: "accessi", colore: "orange" },
  TOTP_CODICI_RIGENERATI: { label: "Nuovi codici di recupero generati", gruppo: "accessi", colore: "blue" },
  TOTP_AZZERATA_DA_ADMIN: { label: "Verifica in due passaggi azzerata da un amministratore", gruppo: "accessi", colore: "red" },
  TOTP_AZZERATA_DA_SERVER: { label: "Verifica in due passaggi azzerata dal server", gruppo: "accessi", colore: "red" },

  // Clienti, contatti e portale
  CLIENTE_CREATO: { label: "Cliente inserito", gruppo: "clienti", colore: "green" },
  CLIENTE_MODIFICATO: { label: "Cliente modificato", gruppo: "clienti", colore: "blue" },
  CLIENTE_ARCHIVIATO: { label: "Cliente archiviato", gruppo: "clienti", colore: "orange" },
  CLIENTE_RIATTIVATO: { label: "Cliente riattivato", gruppo: "clienti", colore: "green" },
  CLIENTE_ELIMINATO: { label: "Cliente eliminato", gruppo: "clienti", colore: "red" },
  CONTATTO_CREATO: { label: "Contatto inserito", gruppo: "clienti", colore: "green" },
  CONTATTO_MODIFICATO: { label: "Contatto modificato", gruppo: "clienti", colore: "blue" },
  CONTATTO_ELIMINATO: { label: "Contatto eliminato", gruppo: "clienti", colore: "red" },
  UTENTE_PORTALE_CREATO: { label: "Accesso al portale creato", gruppo: "clienti", colore: "green" },
  UTENTE_PORTALE_COLLEGATO: { label: "Utente del portale collegato a un cliente", gruppo: "clienti", colore: "green" },
  UTENTE_PORTALE_SCOLLEGATO: { label: "Utente del portale scollegato da un cliente", gruppo: "clienti", colore: "orange" },
  UTENTE_PORTALE_PASSWORD_RESET: { label: "Password del portale reimpostata", gruppo: "clienti", colore: "orange" },
  UTENTE_PORTALE_ATTIVATO: { label: "Accesso al portale riattivato", gruppo: "clienti", colore: "green" },
  UTENTE_PORTALE_DISATTIVATO: { label: "Accesso al portale disattivato", gruppo: "clienti", colore: "orange" },
  ACCESSO_PORTALE_NEGATO: { label: "Gestione del portale rifiutata", gruppo: "clienti", colore: "red" },

  // Attività e adempimenti
  TASK_CREATA: { label: "Attività creata", gruppo: "attivita", colore: "green" },
  TASK_MODIFICATA: { label: "Attività modificata", gruppo: "attivita", colore: "blue" },
  TASK_RIASSEGNATA: { label: "Attività riassegnata", gruppo: "attivita", colore: "purple" },
  TASK_STATO: { label: "Stato dell'attività cambiato", gruppo: "attivita", colore: "blue" },
  TASK_COMPLETATA: { label: "Attività completata", gruppo: "attivita", colore: "green" },
  TASK_NOTE: { label: "Note dell'attività modificate", gruppo: "attivita", colore: "slate" },
  TASK_ELIMINATA: { label: "Attività eliminata", gruppo: "attivita", colore: "red" },
  PIANIFICAZIONE: { label: "Adempimenti dell'anno pianificati", gruppo: "attivita", colore: "purple" },
  PIANIFICAZIONE_MASSIVA: { label: "Pianificazione per tutti i clienti", gruppo: "attivita", colore: "purple" },
  OVERRIDE_ADEMPIMENTO: { label: "Adempimento attivato o escluso per un cliente", gruppo: "attivita", colore: "blue" },
  TEMPLATE_CREATO: { label: "Adempimento aggiunto al catalogo", gruppo: "attivita", colore: "green" },
  TEMPLATE_MODIFICATO: { label: "Adempimento del catalogo modificato", gruppo: "attivita", colore: "blue" },
  TEMPLATE_ELIMINATO: { label: "Adempimento eliminato dal catalogo", gruppo: "attivita", colore: "red" },

  // Documenti
  DOCUMENTO_CARICATO: { label: "Documento caricato dallo studio", gruppo: "documenti", colore: "green" },
  DOCUMENTO_CARICATO_CLIENTE: { label: "Documento caricato dal cliente", gruppo: "documenti", colore: "teal" },
  DOCUMENTO_ELIMINATO: { label: "Documento eliminato", gruppo: "documenti", colore: "red" },
  DOCUMENTO_SPOSTATO: { label: "Documento spostato", gruppo: "documenti", colore: "blue" },
  DOCUMENTO_NOTA_MODIFICATA: { label: "Nota del documento modificata", gruppo: "documenti", colore: "slate" },
  CARTELLA_CREATA: { label: "Cartella creata", gruppo: "documenti", colore: "green" },
  CARTELLA_MODIFICATA: { label: "Cartella modificata", gruppo: "documenti", colore: "blue" },
  CARTELLA_ELIMINATA: { label: "Cartella eliminata", gruppo: "documenti", colore: "red" },

  // Email
  EMAIL_ASSOCIATA: { label: "Email associata a un cliente", gruppo: "email", colore: "green" },
  EMAIL_DISSOCIATA: { label: "Associazione dell'email rimossa", gruppo: "email", colore: "orange" },
  EMAIL_ARCHIVIATA: { label: "Email archiviata", gruppo: "email", colore: "slate" },
  EMAIL_RIPRISTINATA: { label: "Email ripristinata", gruppo: "email", colore: "slate" },
  EMAIL_ALLEGATO_SALVATO: { label: "Allegato salvato tra i documenti", gruppo: "email", colore: "teal" },
  EMAIL_SYNC: { label: "Posta sincronizzata a mano", gruppo: "email", colore: "slate" },
  GMAIL_COLLEGATO: { label: "Casella Gmail collegata", gruppo: "email", colore: "green" },
  GMAIL_SCOLLEGATO: { label: "Casella Gmail scollegata", gruppo: "email", colore: "orange" },

  // Collaboratori e assenze
  COLLABORATORE_CREATO: { label: "Collaboratore inserito", gruppo: "collaboratori", colore: "green" },
  COLLABORATORE_MODIFICATO: { label: "Collaboratore modificato", gruppo: "collaboratori", colore: "blue" },
  COLLABORATORE_DISATTIVATO: { label: "Collaboratore disattivato", gruppo: "collaboratori", colore: "red" },
  COLLABORATORE_RIATTIVATO: { label: "Collaboratore riattivato", gruppo: "collaboratori", colore: "green" },
  RUOLO_MODIFICATO: { label: "Ruolo cambiato", gruppo: "collaboratori", colore: "orange" },
  PASSWORD_TEMPORANEA: { label: "Password temporanea impostata", gruppo: "collaboratori", colore: "orange" },
  INVITO_REINVIATO: { label: "Invito inviato di nuovo", gruppo: "collaboratori", colore: "slate" },
  ASSENZA_RICHIESTA: { label: "Assenza richiesta", gruppo: "collaboratori", colore: "yellow" },
  ASSENZA_INSERITA: { label: "Assenza inserita", gruppo: "collaboratori", colore: "blue" },
  ASSENZA_APPROVATA: { label: "Assenza approvata", gruppo: "collaboratori", colore: "green" },
  ASSENZA_RIFIUTATA: { label: "Assenza rifiutata", gruppo: "collaboratori", colore: "red" },
  ASSENZA_ANNULLATA: { label: "Richiesta di assenza annullata", gruppo: "collaboratori", colore: "slate" },
  ASSENZA_ELIMINATA: { label: "Assenza eliminata", gruppo: "collaboratori", colore: "red" },
  CHAT_MESSAGGIO_ELIMINATO: { label: "Messaggio della chat eliminato", gruppo: "collaboratori", colore: "red" },

  // Sistema
  CRON_MANUALE: { label: "Elaborazione automatica avviata a mano", gruppo: "sistema", colore: "purple" },
  JOB_GIORNALIERI_MANUALI: { label: "Promemoria e allerte inviati a mano", gruppo: "sistema", colore: "purple" },
  NOTIFICHE_PULITE: { label: "Notifiche lette eliminate", gruppo: "sistema", colore: "slate" },
};

/** Etichetta di un'azione; una sconosciuta diventa leggibile invece di restare una sigla. */
export function etichettaAzione(azione: string): DescrizioneAzione {
  const nota = AZIONI[azione];
  if (nota) return nota;
  const testo = azione.toLowerCase().replace(/_/g, " ");
  return { label: testo.charAt(0).toUpperCase() + testo.slice(1), gruppo: "sistema", colore: "slate" };
}

/** Le azioni di un gruppo, per il filtro. */
export function azioniDelGruppo(gruppo: string) {
  return Object.entries(AZIONI)
    .filter(([, d]) => d.gruppo === gruppo)
    .map(([k]) => k);
}

export const ENTITA: Record<string, string> = {
  User: "Persona",
  Client: "Cliente",
  ClientContact: "Contatto",
  Task: "Attività",
  Document: "Documento",
  DocumentFolder: "Cartella",
  EmailMessage: "Email",
  GoogleAccount: "Casella Gmail",
  AdempimentoTemplate: "Adempimento",
  Absence: "Assenza",
  ChatMessage: "Messaggio della chat",
  Notification: "Notifica",
  Cron: "Elaborazione automatica",
  Sistema: "Sistema",
};

/**
 * Le sole operazioni registrate di proposito senza autore: chi sta tentando di entrare non è ancora
 * nessuno. Ogni altra riga senza autore apparteneva a un account poi eliminato (la relazione si azzera
 * alla cancellazione): mostrarla come «tentativo» o «automatica» sarebbe falso. tests/unit/registro.test.ts
 * verifica che nel codice nessun'altra chiamata ad audit() ometta l'autore.
 */
export const AZIONI_SENZA_AUTORE = new Set(["LOGIN_FALLITO", "LOGIN_BLOCCATO"]);
/** Operazioni eseguite sul server da riga di comando (scripts/), dove non c'è nessun utente collegato. */
export const AZIONI_DAL_SERVER = new Set(["TOTP_AZZERATA_DA_SERVER"]);

export function autoreAssente(azione: string): "tentativo" | "server" | "eliminato" {
  if (AZIONI_SENZA_AUTORE.has(azione)) return "tentativo";
  return AZIONI_DAL_SERVER.has(azione) ? "server" : "eliminato";
}

/** Dettagli registrati: audit() li tronca a 4000 caratteri, e un JSON troncato non si può leggere. */
export function leggiDettagli(testo: string | null): { dati: Record<string, unknown> | null; troncati: boolean; grezzo: string | null } {
  if (!testo) return { dati: null, troncati: false, grezzo: null };
  try {
    const v = JSON.parse(testo) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) return { dati: v as Record<string, unknown>, troncati: false, grezzo: null };
    return { dati: { valore: v }, troncati: false, grezzo: null };
  } catch {
    return { dati: null, troncati: testo.length >= 4000, grezzo: testo };
  }
}

/** Nomi dei campi registrati nei dettagli. */
export const CAMPI: Record<string, string> = {
  email: "Email",
  nome: "Nome",
  denominazione: "Cliente",
  titolo: "Titolo",
  ip: "Indirizzo di rete",
  operazione: "Operazione",
  motivo: "Motivo",
  anno: "Anno",
  creati: "Create",
  esistenti: "Già presenti",
  dateDiverse: "Con data diversa dal catalogo",
  altriClienti: "Altre aziende",
  clientiPassati: "Clienti passati",
  attivitaPassate: "Attività passate",
  a: "Dopo",
  da: "Prima",
  esito: "Esito",
  googleEmail: "Casella",
  emailScollegate: "Email scollegate",
  documentiScollegati: "Documenti scollegati",
  emailRimosse: "Email rimosse",
  documentiSpostati: "Documenti spostati",
  sottocartelle: "Sottocartelle",
  scadenza: "Scadenza",
  priorita: "Priorità",
  stato: "Stato",
  ruolo: "Ruolo",
  note: "Note",
  codice: "Codice",
  template: "Adempimento",
  valore: "Valore",
  tipo: "Tipo",
  dataInizio: "Dal",
  dataFine: "Al",
  clienti: "Clienti",
  caselle: "Caselle",
  imported: "Importate",
  linked: "Associate",
  eliminate: "Eliminate",
  sostituita: "Sostituiva una password",
  invitoEmail: "Invito inviato",
  prendiInCarico: "Presa in carico",
  origine: "Da",
  attivo: "Attivo",
  visibileCliente: "Visibile al cliente",
  clientePuoCaricare: "Il cliente può caricare",
  notificaEmail: "Avvisi via email",
  notificaPush: "Avvisi sul dispositivo",
  assigneeId: "Assegnatario",
  userId: "Persona",
  authorId: "Autore",
  clientId: "Cliente",
  precedenteClientId: "Cliente precedente",
  metodo: "Con",
  rimasti: "Codici di recupero rimasti",
  con: "Con",
};

/** Campi che contengono l'identificativo di una persona o di un cliente: a schermo va il nome. */
export const CAMPI_PERSONA = new Set(["assigneeId", "userId", "authorId"]);
export const CAMPI_CLIENTE = new Set(["clientId", "precedenteClientId"]);
/** Campi che sono un giorno, non un istante. */
export const CAMPI_GIORNO = new Set(["scadenza", "dataInizio", "dataFine"]);

function oggetto(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Valori in codice (stati, ruoli, priorità, tipi di assenza) con la loro etichetta. */
export const CODICI: Record<string, string> = { ...RUOLI, ...STATI_TASK, ...PRIORITA_TASK, ...TIPI_ASSENZA, ...STATI_ASSENZA };

/** Un identificativo generato dal database (cuid). */
export function sembraId(v: unknown): v is string {
  return typeof v === "string" && /^c[a-z0-9]{20,32}$/.test(v);
}

/**
 * Gli identificativi citati nei dettagli, anche dentro «prima» e «dopo»: in alcune operazioni «da» e
 * «a» sono persone (riassegnazione) o cartelle (spostamento), quindi si raccolgono tutti e si cercano
 * fra persone, clienti e cartelle.
 */
export function idCitati(dati: Record<string, unknown> | null) {
  const ids = new Set<string>();
  const visita = (o: Record<string, unknown>, profondita: number) => {
    for (const v of Object.values(o)) {
      if (sembraId(v)) ids.add(v);
      else if (oggetto(v) && profondita < 2) visita(v, profondita + 1);
    }
  };
  if (dati) visita(dati, 0);
  return ids;
}

/**
 * Una modifica registrata come { prima, dopo }: solo i campi cambiati. Senza questo l'amministratore
 * dovrebbe confrontare a occhio due elenchi di valori.
 */
export function differenze(dati: Record<string, unknown> | null): { campo: string; prima: unknown; dopo: unknown }[] | null {
  if (!dati || !oggetto(dati.prima) || !oggetto(dati.dopo)) return null;
  const prima = dati.prima;
  const dopo = dati.dopo;
  const campi = [...new Set([...Object.keys(prima), ...Object.keys(dopo)])];
  return campi.filter((c) => JSON.stringify(prima[c] ?? null) !== JSON.stringify(dopo[c] ?? null)).map((c) => ({ campo: c, prima: prima[c] ?? null, dopo: dopo[c] ?? null }));
}
