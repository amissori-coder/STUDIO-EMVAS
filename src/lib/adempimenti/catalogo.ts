// Catalogo predefinito degli adempimenti fiscali/contabili italiani.
// Viene caricato dal seed (prisma/seed.ts) e può essere modificato dall'area "Adempimenti".
//
// Formato scadenze:
//  - MENSILE:   [{ giorno: 16, offsetMeseCompetenza: -1 }]  -> una scadenza ogni mese dell'anno;
//               l'etichetta di periodo è il mese di competenza (mese scadenza + offset).
//  - ANNUALE / TRIMESTRALE: [{ mese, giorno, etichetta? }] -> una scadenza per ogni voce.
//    Nelle etichette si possono usare i segnaposto {anno}, {annoPrec} (anno-1) e {annoPrec2} (anno-2).
//  Le date tra il 1° e il 20 agosto vengono prorogate al 20 agosto (proroga di Ferragosto) e tutte le
//  scadenze slittano al primo giorno lavorativo (vedi calendario.ts).
//    giorno = 0 significa "ultimo giorno del mese".

import type { CategoriaAdempimento, RegimeFiscale, Ricorrenza, TipoSoggetto } from "@/lib/constants";

export interface ScadenzaMensile { giorno: number; offsetMeseCompetenza?: number }
export interface ScadenzaFissa { mese: number; giorno: number; etichetta?: string }
export type ScadenzaRegola = ScadenzaMensile | ScadenzaFissa;

export interface TemplateCatalogo {
  codice: string;
  nome: string;
  descrizione: string;
  categoria: CategoriaAdempimento;
  ricorrenza: Ricorrenza;
  scadenze: ScadenzaRegola[];
  regimi?: RegimeFiscale[];
  tipiSoggetto?: TipoSoggetto[];
  soloConDipendenti?: boolean;
  soloConIva?: boolean;
  periodicitaIva?: "MENSILE" | "TRIMESTRALE";
  soloSuRichiesta?: boolean;
  giorniPreavviso?: number;
}

const IVA_ORDINARIA: RegimeFiscale[] = ["ORDINARIO", "SEMPLIFICATO"];
const IMPRESE_E_PROFESSIONISTI: TipoSoggetto[] = ["DITTA_INDIVIDUALE", "PROFESSIONISTA", "SNC", "SAS", "SRL", "SRLS", "SPA"];
const SOSTITUTI: TipoSoggetto[] = ["DITTA_INDIVIDUALE", "PROFESSIONISTA", "SNC", "SAS", "SRL", "SRLS", "SPA", "ASSOCIAZIONE", "CONDOMINIO"];
const SOCIETA_CAPITALI: TipoSoggetto[] = ["SRL", "SRLS", "SPA"];
const SOCIETA_PERSONE: TipoSoggetto[] = ["SNC", "SAS"];

export const CATALOGO_ADEMPIMENTI: TemplateCatalogo[] = [
  // ---------------- IVA ----------------
  {
    codice: "IVA_LIQ_MENSILE",
    nome: "Liquidazione e versamento IVA mensile",
    descrizione: "Liquidazione periodica IVA e versamento con F24 entro il 16 del mese successivo.",
    categoria: "IVA",
    ricorrenza: "MENSILE",
    scadenze: [{ giorno: 16, offsetMeseCompetenza: -1 }],
    regimi: IVA_ORDINARIA,
    soloConIva: true,
    periodicitaIva: "MENSILE",
    giorniPreavviso: 7,
  },
  {
    codice: "IVA_LIQ_TRIMESTRALE",
    nome: "Liquidazione e versamento IVA trimestrale",
    descrizione: "Liquidazione IVA trimestrale con maggiorazione dell'1% (contribuenti trimestrali per opzione).",
    categoria: "IVA",
    ricorrenza: "TRIMESTRALE",
    scadenze: [
      { mese: 5, giorno: 16, etichetta: "1° trimestre {anno}" },
      { mese: 8, giorno: 20, etichetta: "2° trimestre {anno}" },
      { mese: 11, giorno: 16, etichetta: "3° trimestre {anno}" },
    ],
    regimi: IVA_ORDINARIA,
    soloConIva: true,
    periodicitaIva: "TRIMESTRALE",
    giorniPreavviso: 10,
  },
  {
    codice: "IVA_SALDO_ANNUALE",
    nome: "Versamento saldo IVA annuale",
    descrizione: "Versamento del saldo IVA risultante dalla dichiarazione annuale (anche 4° trimestre per i trimestrali).",
    categoria: "IVA",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 3, giorno: 16, etichetta: "Anno {annoPrec}" }],
    regimi: IVA_ORDINARIA,
    soloConIva: true,
    giorniPreavviso: 10,
  },
  {
    codice: "IVA_ACCONTO",
    nome: "Acconto IVA",
    descrizione: "Versamento dell'acconto IVA (metodo storico, previsionale o analitico).",
    categoria: "IVA",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 12, giorno: 27, etichetta: "Anno {anno}" }],
    regimi: IVA_ORDINARIA,
    soloConIva: true,
    giorniPreavviso: 10,
  },
  {
    codice: "LIPE",
    nome: "Comunicazione liquidazioni periodiche IVA (LIPE)",
    descrizione: "Invio telematico della comunicazione trimestrale delle liquidazioni periodiche IVA.",
    categoria: "IVA",
    ricorrenza: "TRIMESTRALE",
    scadenze: [
      { mese: 2, giorno: 0, etichetta: "4° trimestre {annoPrec}" },
      { mese: 5, giorno: 31, etichetta: "1° trimestre {anno}" },
      { mese: 9, giorno: 30, etichetta: "2° trimestre {anno}" },
      { mese: 11, giorno: 30, etichetta: "3° trimestre {anno}" },
    ],
    regimi: IVA_ORDINARIA,
    soloConIva: true,
    giorniPreavviso: 10,
  },
  {
    codice: "IVA_DICHIARAZIONE",
    nome: "Dichiarazione IVA annuale",
    descrizione: "Presentazione telematica della dichiarazione IVA annuale.",
    categoria: "IVA",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 4, giorno: 30, etichetta: "Anno {annoPrec}" }],
    regimi: IVA_ORDINARIA,
    soloConIva: true,
    giorniPreavviso: 20,
  },
  {
    codice: "IVA_TR",
    nome: "Modello IVA TR (credito trimestrale)",
    descrizione: "Richiesta di rimborso o compensazione del credito IVA trimestrale.",
    categoria: "IVA",
    ricorrenza: "TRIMESTRALE",
    scadenze: [
      { mese: 4, giorno: 30, etichetta: "1° trimestre {anno}" },
      { mese: 7, giorno: 31, etichetta: "2° trimestre {anno}" },
      { mese: 10, giorno: 31, etichetta: "3° trimestre {anno}" },
    ],
    regimi: IVA_ORDINARIA,
    soloConIva: true,
    soloSuRichiesta: true,
    giorniPreavviso: 10,
  },
  {
    codice: "BOLLO_FE",
    nome: "Imposta di bollo su fatture elettroniche",
    descrizione: "Versamento trimestrale dell'imposta di bollo sulle fatture elettroniche (se dovuta).",
    categoria: "IVA",
    ricorrenza: "TRIMESTRALE",
    scadenze: [
      { mese: 2, giorno: 0, etichetta: "4° trimestre {annoPrec}" },
      { mese: 5, giorno: 31, etichetta: "1° trimestre {anno}" },
      { mese: 9, giorno: 30, etichetta: "2° trimestre {anno}" },
      { mese: 11, giorno: 30, etichetta: "3° trimestre {anno}" },
    ],
    soloConIva: true,
    giorniPreavviso: 7,
  },
  {
    codice: "CONSERVAZIONE_FE",
    nome: "Conservazione digitale fatture elettroniche",
    descrizione:
      "Conservazione a norma delle fatture elettroniche entro tre mesi dal termine di presentazione della dichiarazione dei redditi dell'anno di riferimento (art. 3 D.M. 17/6/2014): le fatture di due anni prima vanno conservate entro il 31 gennaio.",
    categoria: "IVA",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 1, giorno: 31, etichetta: "Fatture {annoPrec2}" }],
    soloConIva: true,
    giorniPreavviso: 15,
  },
  {
    codice: "INTRASTAT",
    nome: "Elenchi Intrastat",
    descrizione: "Presentazione degli elenchi riepilogativi Intrastat (mensili).",
    categoria: "IVA",
    ricorrenza: "MENSILE",
    scadenze: [{ giorno: 25, offsetMeseCompetenza: -1 }],
    regimi: IVA_ORDINARIA,
    soloConIva: true,
    soloSuRichiesta: true,
    giorniPreavviso: 7,
  },
  {
    codice: "ESTEROMETRO",
    nome: "Comunicazione operazioni transfrontaliere",
    descrizione: "Trasmissione via SdI dei dati delle operazioni con l'estero (entro il 15 del mese successivo per gli acquisti).",
    categoria: "IVA",
    ricorrenza: "MENSILE",
    scadenze: [{ giorno: 15, offsetMeseCompetenza: -1 }],
    regimi: IVA_ORDINARIA,
    soloConIva: true,
    soloSuRichiesta: true,
    giorniPreavviso: 5,
  },

  // ---------------- Imposte dirette e dichiarazioni ----------------
  {
    codice: "IMPOSTE_SALDO_ACCONTO",
    nome: "Versamento saldo e primo acconto imposte",
    descrizione: "Saldo anno precedente e primo acconto IRPEF/IRES/IRAP/imposta sostitutiva (F24). Possibile rateizzazione.",
    categoria: "IMPOSTE_DIRETTE",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 6, giorno: 30, etichetta: "Saldo {annoPrec} e 1° acconto {anno}" }],
    giorniPreavviso: 15,
  },
  {
    codice: "IMPOSTE_SECONDO_ACCONTO",
    nome: "Versamento secondo acconto imposte",
    descrizione: "Secondo o unico acconto IRPEF/IRES/IRAP/imposta sostitutiva (F24).",
    categoria: "IMPOSTE_DIRETTE",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 11, giorno: 30, etichetta: "2° acconto {anno}" }],
    giorniPreavviso: 15,
  },
  {
    codice: "REDDITI_PF",
    nome: "Modello Redditi Persone Fisiche",
    descrizione: "Presentazione telematica del modello Redditi PF (titolari di partita IVA e altri soggetti).",
    categoria: "DICHIARAZIONI",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 10, giorno: 31, etichetta: "Redditi {annoPrec}" }],
    tipiSoggetto: ["PERSONA_FISICA", "DITTA_INDIVIDUALE", "PROFESSIONISTA"],
    giorniPreavviso: 30,
  },
  {
    codice: "MODELLO_730",
    nome: "Modello 730",
    descrizione: "Presentazione del modello 730 (lavoratori dipendenti e pensionati).",
    categoria: "DICHIARAZIONI",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 9, giorno: 30, etichetta: "Redditi {annoPrec}" }],
    tipiSoggetto: ["PERSONA_FISICA"],
    regimi: ["NON_TITOLARE"],
    giorniPreavviso: 30,
  },
  {
    codice: "REDDITI_SP",
    nome: "Modello Redditi Società di Persone",
    descrizione: "Presentazione telematica del modello Redditi SP.",
    categoria: "DICHIARAZIONI",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 10, giorno: 31, etichetta: "Redditi {annoPrec}" }],
    tipiSoggetto: SOCIETA_PERSONE,
    giorniPreavviso: 30,
  },
  {
    codice: "REDDITI_SC",
    nome: "Modello Redditi Società di Capitali",
    descrizione: "Presentazione telematica del modello Redditi SC (esercizio coincidente con l'anno solare).",
    categoria: "DICHIARAZIONI",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 10, giorno: 31, etichetta: "Redditi {annoPrec}" }],
    tipiSoggetto: SOCIETA_CAPITALI,
    giorniPreavviso: 30,
  },
  {
    codice: "REDDITI_ENC",
    nome: "Modello Redditi Enti non commerciali",
    descrizione: "Presentazione telematica del modello Redditi ENC.",
    categoria: "DICHIARAZIONI",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 10, giorno: 31, etichetta: "Redditi {annoPrec}" }],
    tipiSoggetto: ["ASSOCIAZIONE"],
    giorniPreavviso: 30,
  },
  {
    codice: "IRAP",
    nome: "Dichiarazione IRAP",
    descrizione: "Presentazione telematica della dichiarazione IRAP.",
    categoria: "DICHIARAZIONI",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 10, giorno: 31, etichetta: "IRAP {annoPrec}" }],
    tipiSoggetto: [...SOCIETA_PERSONE, ...SOCIETA_CAPITALI],
    regimi: IVA_ORDINARIA,
    giorniPreavviso: 30,
  },
  {
    codice: "FORFETTARIO_REQUISITI",
    nome: "Verifica requisiti regime forfettario",
    descrizione: "Controllo di ricavi/compensi, spese per lavoro e cause ostative per la permanenza nel regime forfettario.",
    categoria: "INTERNO_STUDIO",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 1, giorno: 31, etichetta: "Verifica anno {annoPrec}" }],
    regimi: ["FORFETTARIO"],
    giorniPreavviso: 15,
  },

  // ---------------- Lavoro / sostituti d'imposta ----------------
  {
    codice: "F24_RITENUTE_CONTRIBUTI",
    nome: "Versamento ritenute e contributi dipendenti (F24)",
    descrizione: "Versamento ritenute IRPEF, addizionali e contributi INPS relativi alle retribuzioni del mese precedente.",
    categoria: "LAVORO",
    ricorrenza: "MENSILE",
    scadenze: [{ giorno: 16, offsetMeseCompetenza: -1 }],
    soloConDipendenti: true,
    giorniPreavviso: 5,
  },
  {
    codice: "UNIEMENS",
    nome: "Denuncia UniEmens",
    descrizione: "Invio telematico della denuncia contributiva UniEmens del mese precedente.",
    categoria: "LAVORO",
    ricorrenza: "MENSILE",
    scadenze: [{ giorno: 0, offsetMeseCompetenza: -1 }],
    soloConDipendenti: true,
    giorniPreavviso: 5,
  },
  {
    codice: "CU",
    nome: "Certificazione Unica (CU)",
    descrizione: "Invio telematico delle Certificazioni Uniche e consegna ai percipienti.",
    categoria: "LAVORO",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 3, giorno: 16, etichetta: "CU {anno} (redditi {annoPrec})" }],
    tipiSoggetto: SOSTITUTI,
    regimi: IVA_ORDINARIA,
    giorniPreavviso: 20,
  },
  {
    codice: "MODELLO_770",
    nome: "Modello 770",
    descrizione: "Dichiarazione dei sostituti d'imposta.",
    categoria: "LAVORO",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 10, giorno: 31, etichetta: "770/{anno} (anno {annoPrec})" }],
    tipiSoggetto: SOSTITUTI,
    regimi: IVA_ORDINARIA,
    giorniPreavviso: 30,
  },
  {
    codice: "TFR_IMPOSTA_SOSTITUTIVA",
    nome: "Imposta sostitutiva rivalutazione TFR",
    descrizione: "Acconto (16 dicembre) e saldo (16 febbraio) dell'imposta sostitutiva sulla rivalutazione del TFR.",
    categoria: "LAVORO",
    ricorrenza: "ANNUALE",
    scadenze: [
      { mese: 2, giorno: 16, etichetta: "Saldo {annoPrec}" },
      { mese: 12, giorno: 16, etichetta: "Acconto {anno}" },
    ],
    soloConDipendenti: true,
    giorniPreavviso: 7,
  },
  {
    codice: "INAIL_AUTOLIQUIDAZIONE",
    nome: "Autoliquidazione INAIL",
    descrizione: "Autoliquidazione del premio INAIL (regolazione anno precedente e rata anno in corso).",
    categoria: "PREVIDENZA",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 2, giorno: 16, etichetta: "Regolazione {annoPrec} / rata {anno}" }],
    soloConDipendenti: true,
    giorniPreavviso: 15,
  },

  // ---------------- Previdenza ----------------
  {
    codice: "INPS_ARTIGIANI_COMMERCIANTI",
    nome: "Contributi INPS artigiani e commercianti (rate fisse)",
    descrizione: "Versamento delle rate trimestrali dei contributi fissi sul minimale.",
    categoria: "PREVIDENZA",
    ricorrenza: "TRIMESTRALE",
    scadenze: [
      { mese: 2, giorno: 16, etichetta: "4ª rata {annoPrec}" },
      { mese: 5, giorno: 16, etichetta: "1ª rata {anno}" },
      { mese: 8, giorno: 20, etichetta: "2ª rata {anno}" },
      { mese: 11, giorno: 16, etichetta: "3ª rata {anno}" },
    ],
    tipiSoggetto: ["DITTA_INDIVIDUALE", "SNC", "SAS"],
    giorniPreavviso: 7,
  },
  {
    codice: "INPS_GESTIONE_SEPARATA",
    nome: "Contributi INPS gestione separata (saldo e acconti)",
    descrizione: "Saldo e acconti dei contributi alla gestione separata INPS per i professionisti senza cassa.",
    categoria: "PREVIDENZA",
    ricorrenza: "ANNUALE",
    scadenze: [
      { mese: 6, giorno: 30, etichetta: "Saldo {annoPrec} e 1° acconto {anno}" },
      { mese: 11, giorno: 30, etichetta: "2° acconto {anno}" },
    ],
    tipiSoggetto: ["PROFESSIONISTA"],
    giorniPreavviso: 15,
  },

  // ---------------- Societario / camerale ----------------
  {
    codice: "BILANCIO_APPROVAZIONE",
    nome: "Approvazione bilancio d'esercizio",
    descrizione: "Assemblea dei soci per l'approvazione del bilancio entro 120 giorni dalla chiusura dell'esercizio.",
    categoria: "SOCIETARIO",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 4, giorno: 30, etichetta: "Bilancio {annoPrec}" }],
    tipiSoggetto: SOCIETA_CAPITALI,
    giorniPreavviso: 30,
  },
  {
    codice: "BILANCIO_DEPOSITO",
    nome: "Deposito bilancio al Registro Imprese",
    descrizione: "Deposito del bilancio approvato entro 30 giorni dall'approvazione.",
    categoria: "SOCIETARIO",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 5, giorno: 30, etichetta: "Bilancio {annoPrec}" }],
    tipiSoggetto: SOCIETA_CAPITALI,
    giorniPreavviso: 15,
  },
  {
    codice: "TASSA_LIBRI_SOCIALI",
    nome: "Tassa annuale vidimazione libri sociali",
    descrizione: "Versamento della tassa annuale di concessione governativa per la numerazione dei libri sociali.",
    categoria: "SOCIETARIO",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 3, giorno: 16, etichetta: "Anno {anno}" }],
    tipiSoggetto: SOCIETA_CAPITALI,
    giorniPreavviso: 10,
  },
  {
    codice: "DIRITTO_CAMERALE",
    nome: "Diritto annuale Camera di Commercio",
    descrizione: "Versamento del diritto annuale CCIAA (con F24, stessa scadenza del saldo imposte).",
    categoria: "CAMERALE",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 6, giorno: 30, etichetta: "Anno {anno}" }],
    tipiSoggetto: ["DITTA_INDIVIDUALE", ...SOCIETA_PERSONE, ...SOCIETA_CAPITALI],
    giorniPreavviso: 15,
  },
  {
    codice: "PEC_DOMICILIO_DIGITALE",
    nome: "Verifica PEC / domicilio digitale",
    descrizione: "Controllo della validità e del rinnovo della PEC iscritta al Registro Imprese / INI-PEC.",
    categoria: "INTERNO_STUDIO",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 1, giorno: 31, etichetta: "Anno {anno}" }],
    tipiSoggetto: IMPRESE_E_PROFESSIONISTI,
    giorniPreavviso: 15,
  },

  // ---------------- Tributi locali ----------------
  {
    codice: "IMU",
    nome: "IMU",
    descrizione: "Versamento acconto e saldo IMU sugli immobili posseduti.",
    categoria: "TRIBUTI_LOCALI",
    ricorrenza: "ANNUALE",
    scadenze: [
      { mese: 6, giorno: 16, etichetta: "Acconto {anno}" },
      { mese: 12, giorno: 16, etichetta: "Saldo {anno}" },
    ],
    soloSuRichiesta: true,
    giorniPreavviso: 10,
  },
  {
    codice: "DICHIARAZIONE_IMU",
    nome: "Dichiarazione IMU",
    descrizione: "Presentazione della dichiarazione IMU per le variazioni intervenute nell'anno precedente.",
    categoria: "TRIBUTI_LOCALI",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 6, giorno: 30, etichetta: "Variazioni {annoPrec}" }],
    soloSuRichiesta: true,
    giorniPreavviso: 15,
  },

  // ---------------- Interno studio ----------------
  {
    codice: "ANTIRICICLAGGIO",
    nome: "Adeguata verifica antiriciclaggio",
    descrizione: "Aggiornamento periodico dell'adeguata verifica della clientela e del fascicolo antiriciclaggio.",
    categoria: "INTERNO_STUDIO",
    ricorrenza: "ANNUALE",
    scadenze: [{ mese: 12, giorno: 31, etichetta: "Anno {anno}" }],
    giorniPreavviso: 30,
  },
  {
    codice: "ROTTAMAZIONE",
    nome: "Rate definizione agevolata / rottamazione",
    descrizione: "Adempimento una tantum: le scadenze delle rate vanno inserite manualmente per il cliente.",
    categoria: "ALTRO",
    ricorrenza: "UNA_TANTUM",
    scadenze: [],
    soloSuRichiesta: true,
    giorniPreavviso: 7,
  },
  {
    codice: "REGISTRAZIONE_LOCAZIONI",
    nome: "Registrazione / rinnovo contratti di locazione",
    descrizione: "Adempimento una tantum: registrazione, proroga o risoluzione contratti (modello RLI).",
    categoria: "ALTRO",
    ricorrenza: "UNA_TANTUM",
    scadenze: [],
    soloSuRichiesta: true,
    giorniPreavviso: 7,
  },
];
