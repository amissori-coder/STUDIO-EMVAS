// Valori ammessi per i campi "enum" (SQLite non supporta gli enum nativi)
// e relative etichette in italiano.

export const RUOLI = {
  ADMIN: "Amministratore",
  COLLABORATORE: "Collaboratore",
  CLIENTE: "Cliente",
} as const;
export type Ruolo = keyof typeof RUOLI;
export const RUOLI_STAFF: Ruolo[] = ["ADMIN", "COLLABORATORE"];

export const TIPI_SOGGETTO = {
  PERSONA_FISICA: "Persona fisica (privato)",
  DITTA_INDIVIDUALE: "Ditta individuale",
  PROFESSIONISTA: "Professionista / lavoratore autonomo",
  SNC: "Società in nome collettivo (S.n.c.)",
  SAS: "Società in accomandita semplice (S.a.s.)",
  SRL: "Società a responsabilità limitata (S.r.l.)",
  SRLS: "S.r.l. semplificata",
  SPA: "Società per azioni (S.p.A.)",
  ASSOCIAZIONE: "Associazione / ente non commerciale",
  CONDOMINIO: "Condominio",
  ALTRO: "Altro",
} as const;
export type TipoSoggetto = keyof typeof TIPI_SOGGETTO;

export const TIPI_SOCIETA_CAPITALI: TipoSoggetto[] = ["SRL", "SRLS", "SPA"];
export const TIPI_SOCIETA_PERSONE: TipoSoggetto[] = ["SNC", "SAS"];
export const TIPI_IMPRESA: TipoSoggetto[] = ["DITTA_INDIVIDUALE", "SNC", "SAS", "SRL", "SRLS", "SPA"];

export const REGIMI_FISCALI = {
  ORDINARIO: "Contabilità ordinaria",
  SEMPLIFICATO: "Contabilità semplificata",
  FORFETTARIO: "Regime forfettario",
  NON_TITOLARE: "Non titolare di partita IVA (privato / 730)",
} as const;
export type RegimeFiscale = keyof typeof REGIMI_FISCALI;

export const PERIODICITA_IVA = {
  MENSILE: "Mensile",
  TRIMESTRALE: "Trimestrale",
  NESSUNA: "Nessuna (esente / forfettario / privato)",
} as const;
export type PeriodicitaIva = keyof typeof PERIODICITA_IVA;

export const CATEGORIE_ADEMPIMENTO = {
  IVA: "IVA",
  IMPOSTE_DIRETTE: "Imposte dirette",
  DICHIARAZIONI: "Dichiarazioni",
  LAVORO: "Lavoro e sostituti d'imposta",
  PREVIDENZA: "Previdenza (INPS / INAIL)",
  SOCIETARIO: "Adempimenti societari",
  CAMERALE: "Camera di Commercio",
  TRIBUTI_LOCALI: "Tributi locali",
  INTERNO_STUDIO: "Interno studio",
  ALTRO: "Altro",
} as const;
export type CategoriaAdempimento = keyof typeof CATEGORIE_ADEMPIMENTO;

export const RICORRENZE = {
  MENSILE: "Mensile",
  TRIMESTRALE: "Trimestrale",
  ANNUALE: "Annuale",
  UNA_TANTUM: "Una tantum (solo manuale)",
} as const;
export type Ricorrenza = keyof typeof RICORRENZE;

export const STATI_TASK = {
  DA_FARE: "Da fare",
  IN_CORSO: "In corso",
  COMPLETATA: "Completata",
  ANNULLATA: "Annullata",
} as const;
export type StatoTask = keyof typeof STATI_TASK;
export const STATI_TASK_APERTI: StatoTask[] = ["DA_FARE", "IN_CORSO"];

export const PRIORITA_TASK = {
  BASSA: "Bassa",
  MEDIA: "Media",
  ALTA: "Alta",
} as const;
export type PrioritaTask = keyof typeof PRIORITA_TASK;

export const TIPI_ASSENZA = {
  FERIE: "Ferie",
  MALATTIA: "Malattia",
  PERMESSO: "Permesso",
  ALTRO: "Altro",
} as const;
export type TipoAssenza = keyof typeof TIPI_ASSENZA;

export const STATI_ASSENZA = {
  RICHIESTA: "In attesa",
  APPROVATA: "Approvata",
  RIFIUTATA: "Rifiutata",
} as const;
export type StatoAssenza = keyof typeof STATI_ASSENZA;

export const TIPI_NOTIFICA = {
  ATTIVITA_ASSEGNATA: "Attività assegnata",
  SCADENZA_VICINA: "Scadenza in arrivo",
  SCADENZA_OGGI: "Scadenza oggi",
  SCADUTA: "Attività scaduta",
  ALLERTA_ASSENZA: "Allerta: collaboratore assente",
  CHAT_MENZIONE: "Menzione in chat",
  CHAT_MESSAGGIO: "Nuovo messaggio in chat",
  EMAIL_CLIENTE: "Nuova email da cliente",
  DOCUMENTO_CARICATO: "Documento caricato dal cliente",
  ASSENZA_RICHIESTA: "Richiesta di assenza",
  ASSENZA_APPROVATA: "Assenza approvata",
  ASSENZA_RIFIUTATA: "Assenza rifiutata",
  SISTEMA: "Sistema",
} as const;
export type TipoNotifica = keyof typeof TIPI_NOTIFICA;

// Cartelle create automaticamente per ogni nuovo cliente (area documenti)
export const CARTELLE_DEFAULT: { nome: string; descrizione: string }[] = [
  { nome: "Fatture di vendita", descrizione: "Fatture emesse ai clienti" },
  { nome: "Fatture di acquisto", descrizione: "Fatture ricevute dai fornitori" },
  { nome: "Corrispettivi", descrizione: "Scontrini / corrispettivi giornalieri" },
  { nome: "Estratti conto bancari", descrizione: "Estratti conto e movimenti bancari" },
  { nome: "F24 e ricevute", descrizione: "Modelli F24 e ricevute di pagamento" },
  { nome: "Buste paga e personale", descrizione: "Cedolini, contratti e documenti del personale" },
  { nome: "Documenti societari", descrizione: "Visure, statuto, verbali, atti" },
  { nome: "Dichiarazioni", descrizione: "Dichiarazioni fiscali e relative ricevute" },
  { nome: "Contratti", descrizione: "Contratti di locazione, fornitura, ecc." },
  { nome: "Altro", descrizione: "Documenti vari" },
];

export const COLORI_UTENTE = [
  "#2563eb", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#ca8a04",
  "#16a34a", "#0d9488", "#0891b2", "#4f46e5",
];

export const SESSION_COOKIE = "emvas_session";
