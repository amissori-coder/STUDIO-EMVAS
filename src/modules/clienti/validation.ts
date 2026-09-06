import { z } from "zod";
import { PERIODICITA_IVA, REGIMI_FISCALI, TIPI_SOGGETTO, type PeriodicitaIva, type RegimeFiscale, type TipoSoggetto } from "@/lib/constants";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Stringa opzionale: spazi rimossi, vuoto -> null */
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Massimo ${max} caratteri.`)
    .transform((v) => (v ? v : null));

const optEmail = z
  .string()
  .trim()
  .max(200, "Massimo 200 caratteri.")
  .refine((v) => v === "" || EMAIL_RE.test(v), "Indirizzo email non valido.")
  .transform((v) => (v ? v.toLowerCase() : null));

export const clientSchema = z.object({
  denominazione: z.string().trim().min(2, "Inserisci la denominazione (almeno 2 caratteri).").max(200, "Massimo 200 caratteri."),
  tipoSoggetto: z.enum(Object.keys(TIPI_SOGGETTO) as [TipoSoggetto, ...TipoSoggetto[]], { error: "Seleziona il tipo di soggetto." }),
  regimeFiscale: z.enum(Object.keys(REGIMI_FISCALI) as [RegimeFiscale, ...RegimeFiscale[]], { error: "Seleziona il regime fiscale." }),
  periodicitaIva: z.enum(Object.keys(PERIODICITA_IVA) as [PeriodicitaIva, ...PeriodicitaIva[]], { error: "Seleziona la periodicità IVA." }),
  haDipendenti: z.boolean(),
  codiceFiscale: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .refine((v) => v === "" || /^[A-Z0-9]{11}$/.test(v) || /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(v), "Codice fiscale non valido (16 caratteri o 11 cifre).")
    .transform((v) => (v ? v : null)),
  partitaIva: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, "").replace(/^IT/i, ""))
    .refine((v) => v === "" || /^\d{11}$/.test(v), "La partita IVA deve essere composta da 11 cifre.")
    .transform((v) => (v ? v : null)),
  codiceAteco: opt(20),
  attivita: opt(300),
  email: optEmail,
  pec: optEmail,
  telefono: opt(50),
  indirizzo: opt(200),
  cap: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{5}$/.test(v), "Il CAP deve avere 5 cifre.")
    .transform((v) => (v ? v : null)),
  comune: opt(100),
  provincia: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => v === "" || /^[A-Z]{2}$/.test(v), "Sigla provincia di 2 lettere (es. RM).")
    .transform((v) => (v ? v : null)),
  note: opt(4000),
  referenteId: opt(64),
  attivo: z.boolean(),
});

export type ClientInput = z.infer<typeof clientSchema>;
export type ClientFieldErrors = Partial<Record<keyof ClientInput, string>>;

/** Valori grezzi del form (stringhe) per ripopolare i campi in caso di errore */
export type ClientFormValues = Record<keyof ClientInput, string>;

export const CLIENT_FORM_FIELDS: (keyof ClientInput)[] = [
  "denominazione",
  "tipoSoggetto",
  "regimeFiscale",
  "periodicitaIva",
  "haDipendenti",
  "codiceFiscale",
  "partitaIva",
  "codiceAteco",
  "attivita",
  "email",
  "pec",
  "telefono",
  "indirizzo",
  "cap",
  "comune",
  "provincia",
  "note",
  "referenteId",
  "attivo",
];

export function readClientForm(formData: FormData): ClientFormValues {
  const out = {} as ClientFormValues;
  for (const k of CLIENT_FORM_FIELDS) {
    const v = formData.get(k);
    out[k] = typeof v === "string" ? v : "";
  }
  return out;
}

export function parseClientForm(formData: FormData): { data?: ClientInput; fieldErrors?: ClientFieldErrors; values: ClientFormValues } {
  const values = readClientForm(formData);
  const result = clientSchema.safeParse({
    ...values,
    haDipendenti: values.haDipendenti === "on" || values.haDipendenti === "true",
    attivo: values.attivo === "on" || values.attivo === "true",
  });
  if (!result.success) {
    const flat = z.flattenError(result.error).fieldErrors;
    const fieldErrors: ClientFieldErrors = {};
    for (const [k, msgs] of Object.entries(flat)) {
      if (msgs && msgs.length) fieldErrors[k as keyof ClientInput] = msgs[0];
    }
    return { fieldErrors, values };
  }
  return { data: result.data, values };
}

export const contactSchema = z.object({
  nome: z.string().trim().min(2, "Inserisci il nome del contatto.").max(120, "Massimo 120 caratteri."),
  email: optEmail,
  telefono: opt(50),
  ruolo: opt(80),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const portalUserSchema = z.object({
  nome: z.string().trim().min(2, "Inserisci il nome dell'utente.").max(120, "Massimo 120 caratteri."),
  email: z.string().trim().min(1, "Inserisci l'email.").refine((v) => EMAIL_RE.test(v), "Indirizzo email non valido.").transform((v) => v.toLowerCase()),
  password: z.string().max(100, "Massimo 100 caratteri."),
});

/** Converte un record Client in valori stringa per il form. */
export function clientToFormValues(c: {
  denominazione: string;
  tipoSoggetto: string;
  regimeFiscale: string;
  periodicitaIva: string;
  haDipendenti: boolean;
  codiceFiscale: string | null;
  partitaIva: string | null;
  codiceAteco: string | null;
  attivita: string | null;
  email: string | null;
  pec: string | null;
  telefono: string | null;
  indirizzo: string | null;
  cap: string | null;
  comune: string | null;
  provincia: string | null;
  note: string | null;
  referenteId: string | null;
  attivo: boolean;
}): ClientFormValues {
  return {
    denominazione: c.denominazione,
    tipoSoggetto: c.tipoSoggetto,
    regimeFiscale: c.regimeFiscale,
    periodicitaIva: c.periodicitaIva,
    haDipendenti: c.haDipendenti ? "on" : "",
    codiceFiscale: c.codiceFiscale ?? "",
    partitaIva: c.partitaIva ?? "",
    codiceAteco: c.codiceAteco ?? "",
    attivita: c.attivita ?? "",
    email: c.email ?? "",
    pec: c.pec ?? "",
    telefono: c.telefono ?? "",
    indirizzo: c.indirizzo ?? "",
    cap: c.cap ?? "",
    comune: c.comune ?? "",
    provincia: c.provincia ?? "",
    note: c.note ?? "",
    referenteId: c.referenteId ?? "",
    attivo: c.attivo ? "on" : "",
  };
}
