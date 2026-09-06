// Helper puri (senza accesso al DB) per i filtri della pagina Assenze: usabili anche lato client.

export interface AbsenceFilters {
  /** YYYY-MM */
  mese: string;
  utente: string;
  stato: string;
  vista: "elenco" | "calendario";
}

export function parseMese(value: string | undefined): { anno: number; mese: number; chiave: string } {
  const now = new Date();
  const m = value ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  const anno = m ? Number(m[1]) : now.getFullYear();
  const mese = m ? Math.min(12, Math.max(1, Number(m[2]))) : now.getMonth() + 1;
  return { anno, mese, chiave: `${anno}-${String(mese).padStart(2, "0")}` };
}

export function parseAbsenceFilters(sp: Record<string, string | string[] | undefined>): AbsenceFilters {
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const vista = str(sp.vista) === "calendario" ? "calendario" : "elenco";
  return { mese: parseMese(str(sp.mese)).chiave, utente: str(sp.utente), stato: str(sp.stato), vista };
}

export function buildAbsenceQuery(f: Partial<AbsenceFilters>) {
  const p = new URLSearchParams();
  if (f.mese) p.set("mese", f.mese);
  if (f.utente) p.set("utente", f.utente);
  if (f.stato) p.set("stato", f.stato);
  if (f.vista && f.vista !== "elenco") p.set("vista", f.vista);
  const s = p.toString();
  return s ? `?${s}` : "";
}

const MESI = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

export function labelMese(chiave: string) {
  const [a, m] = chiave.split("-").map(Number);
  return `${MESI[m! - 1]} ${a}`;
}

export function shiftMese(chiave: string, delta: number) {
  const [a, m] = chiave.split("-").map(Number);
  const d = new Date(a!, m! - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
