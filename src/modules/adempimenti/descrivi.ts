// Descrizioni leggibili delle regole di un adempimento (scadenze e applicabilità). Solo funzioni pure.
import { PERIODICITA_IVA, REGIMI_FISCALI, type TipoSoggetto } from "@/lib/constants";
import { safeJsonParse } from "@/lib/utils";
import type { ScadenzaFissa, ScadenzaMensile, ScadenzaRegola } from "@/lib/adempimenti/catalogo";

/** Etichette brevi dei tipi soggetto (quelle complete in constants sono troppo lunghe per i riepiloghi). */
export const TIPI_SOGGETTO_BREVI: Record<TipoSoggetto, string> = {
  PERSONA_FISICA: "Persona fisica",
  DITTA_INDIVIDUALE: "Ditta individuale",
  PROFESSIONISTA: "Professionista",
  SNC: "S.n.c.",
  SAS: "S.a.s.",
  SRL: "S.r.l.",
  SRLS: "S.r.l.s.",
  SPA: "S.p.A.",
  ASSOCIAZIONE: "Associazione / ente",
  CONDOMINIO: "Condominio",
  ALTRO: "Altro",
};

export const REGIMI_BREVI: Record<string, string> = {
  ORDINARIO: "Ordinario",
  SEMPLIFICATO: "Semplificato",
  FORFETTARIO: "Forfettario",
  NON_TITOLARE: "Senza P. IVA",
};

const MESI_BREVI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function descriviOffset(offset: number) {
  if (offset === 0) return "stesso mese";
  if (offset === -1) return "mese precedente";
  if (offset === -2) return "due mesi prima";
  if (offset < 0) return `${-offset} mesi prima`;
  if (offset === 1) return "mese successivo";
  return `${offset} mesi dopo`;
}

export function parseScadenze(json: string): ScadenzaRegola[] {
  const v = safeJsonParse<unknown>(json, []);
  return Array.isArray(v) ? (v as ScadenzaRegola[]) : [];
}

/** Descrizione testuale delle scadenze: es. "16 di ogni mese (competenza mese precedente)" oppure "30/04 – Anno {annoPrec}". */
export function descriviScadenze(t: { ricorrenza: string; scadenze: string }, anno?: number): string[] {
  const regole = parseScadenze(t.scadenze);
  if (t.ricorrenza === "MENSILE") {
    const r = (regole[0] ?? { giorno: 16, offsetMeseCompetenza: -1 }) as ScadenzaMensile;
    const giorno = r.giorno === 0 ? "Ultimo giorno" : `Il ${r.giorno}`;
    return [`${giorno} di ogni mese (competenza ${descriviOffset(r.offsetMeseCompetenza ?? -1)})`];
  }
  if (t.ricorrenza === "UNA_TANTUM") return ["Solo manuale: nessuna scadenza automatica"];
  return regole
    .filter((r): r is ScadenzaFissa => typeof (r as ScadenzaFissa).mese === "number" && (r as ScadenzaFissa).mese >= 1)
    .map((r) => {
      const g = r.giorno === 0 ? `fine ${MESI_BREVI[r.mese - 1]}` : `${pad(r.giorno)}/${pad(r.mese)}`;
      const etichetta = r.etichetta
        ? anno
          ? r.etichetta.replace(/\{anno\}/g, String(anno)).replace(/\{annoPrec\}/g, String(anno - 1))
          : r.etichetta
        : "";
      return etichetta ? `${g} – ${etichetta}` : g;
    });
}

export interface ApplicabilitaVoce {
  label: string;
  tono: "slate" | "blue" | "green" | "yellow" | "purple" | "orange" | "teal" | "red";
}

/** Riassunto delle condizioni di applicabilità come elenco di chip. */
export function descriviApplicabilita(t: {
  regimi: string;
  tipiSoggetto: string;
  soloConDipendenti: boolean | null;
  soloConIva: boolean | null;
  periodicitaIva: string | null;
  soloSuRichiesta: boolean;
}): ApplicabilitaVoce[] {
  const out: ApplicabilitaVoce[] = [];
  const regimi = safeJsonParse<string[]>(t.regimi, []);
  const tipi = safeJsonParse<string[]>(t.tipiSoggetto, []);
  if (regimi.length) out.push({ label: `Regime: ${regimi.map((r) => REGIMI_BREVI[r] ?? REGIMI_FISCALI[r as keyof typeof REGIMI_FISCALI] ?? r).join(", ")}`, tono: "blue" });
  else out.push({ label: "Tutti i regimi", tono: "slate" });
  if (tipi.length) out.push({ label: `Soggetti: ${tipi.map((s) => TIPI_SOGGETTO_BREVI[s as TipoSoggetto] ?? s).join(", ")}`, tono: "teal" });
  else out.push({ label: "Tutti i soggetti", tono: "slate" });
  if (t.soloConDipendenti === true) out.push({ label: "Solo con dipendenti", tono: "purple" });
  if (t.soloConDipendenti === false) out.push({ label: "Solo senza dipendenti", tono: "purple" });
  if (t.soloConIva === true) out.push({ label: "Solo con partita IVA", tono: "orange" });
  if (t.soloConIva === false) out.push({ label: "Solo senza partita IVA", tono: "orange" });
  if (t.periodicitaIva) out.push({ label: `IVA ${PERIODICITA_IVA[t.periodicitaIva as keyof typeof PERIODICITA_IVA]?.toLowerCase() ?? t.periodicitaIva}`, tono: "orange" });
  if (t.soloSuRichiesta) out.push({ label: "Solo su richiesta (da attivare per cliente)", tono: "yellow" });
  return out;
}
