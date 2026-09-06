// Regole pure (senza accesso al DB) per applicabilità e calcolo delle scadenze degli adempimenti.
import type { AdempimentoTemplate, Client } from "@prisma/client";
import { safeJsonParse } from "@/lib/utils";
import { MESI, primoGiornoLavorativo, ultimoGiornoMese } from "@/lib/adempimenti/calendario";
import type { ScadenzaFissa, ScadenzaMensile, ScadenzaRegola } from "@/lib/adempimenti/catalogo";

export type ClientProfilo = Pick<
  Client,
  "id" | "tipoSoggetto" | "regimeFiscale" | "periodicitaIva" | "haDipendenti" | "partitaIva"
>;

export interface ScadenzaCalcolata {
  idx: number;
  scadenza: Date;
  periodo: string;
  titolo: string;
}

function sostituisci(s: string, anno: number) {
  return s.replace(/\{anno\}/g, String(anno)).replace(/\{annoPrec\}/g, String(anno - 1));
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Verifica se un adempimento si applica al profilo del cliente (senza considerare gli override). */
export function isApplicabile(t: AdempimentoTemplate, c: ClientProfilo): boolean {
  if (!t.attivo) return false;
  const regimi = safeJsonParse<string[]>(t.regimi, []);
  if (regimi.length && !regimi.includes(c.regimeFiscale)) return false;
  const tipi = safeJsonParse<string[]>(t.tipiSoggetto, []);
  if (tipi.length && !tipi.includes(c.tipoSoggetto)) return false;
  if (t.soloConDipendenti === true && !c.haDipendenti) return false;
  if (t.soloConDipendenti === false && c.haDipendenti) return false;
  const haIva = !!c.partitaIva && c.regimeFiscale !== "NON_TITOLARE";
  if (t.soloConIva === true && !haIva) return false;
  if (t.soloConIva === false && haIva) return false;
  if (t.periodicitaIva && c.periodicitaIva !== t.periodicitaIva) return false;
  return true;
}

/**
 * Decide se generare l'adempimento per il cliente, tenendo conto dell'override per cliente:
 *  - override.attivo === false  -> mai
 *  - override.attivo === true   -> sempre (anche se "solo su richiesta" o non applicabile per profilo)
 *  - nessun override            -> applicabile per profilo e non "solo su richiesta"
 */
export function deveGenerare(t: AdempimentoTemplate, c: ClientProfilo, override?: { attivo: boolean } | null): boolean {
  if (!t.attivo) return false;
  if (override) return override.attivo;
  if (t.soloSuRichiesta) return false;
  return isApplicabile(t, c);
}

/** Calcola le scadenze di un adempimento per un anno (date già spostate al primo giorno lavorativo). */
export function calcolaScadenze(t: AdempimentoTemplate, anno: number): ScadenzaCalcolata[] {
  const regole = safeJsonParse<ScadenzaRegola[]>(t.scadenze, []);
  const out: ScadenzaCalcolata[] = [];

  if (t.ricorrenza === "MENSILE") {
    const regola = (regole[0] ?? { giorno: 16, offsetMeseCompetenza: -1 }) as ScadenzaMensile;
    const offset = regola.offsetMeseCompetenza ?? -1;
    for (let mese = 1; mese <= 12; mese++) {
      const giorno = regola.giorno === 0 ? ultimoGiornoMese(anno, mese) : Math.min(regola.giorno, ultimoGiornoMese(anno, mese));
      const data = primoGiornoLavorativo(new Date(anno, mese - 1, giorno, 12));
      let mc = mese + offset;
      let annoComp = anno;
      if (mc < 1) { mc += 12; annoComp -= 1; }
      if (mc > 12) { mc -= 12; annoComp += 1; }
      const periodo = `${capitalize(MESI[mc - 1])} ${annoComp}`;
      out.push({ idx: mese, scadenza: data, periodo, titolo: `${t.nome} – ${periodo}` });
    }
    return out;
  }

  if (t.ricorrenza === "UNA_TANTUM") return out;

  regole.forEach((r, i) => {
    const f = r as ScadenzaFissa;
    if (!f.mese) return;
    const giorno = f.giorno === 0 ? ultimoGiornoMese(anno, f.mese) : Math.min(f.giorno, ultimoGiornoMese(anno, f.mese));
    const data = primoGiornoLavorativo(new Date(anno, f.mese - 1, giorno, 12));
    const periodo = f.etichetta ? sostituisci(f.etichetta, anno) : `${anno}`;
    out.push({ idx: i + 1, scadenza: data, periodo, titolo: f.etichetta ? `${t.nome} – ${periodo}` : t.nome });
  });
  return out.sort((a, b) => a.scadenza.getTime() - b.scadenza.getTime());
}

export function chiaveTask(clientId: string, templateId: string, anno: number, idx: number) {
  return `${clientId}:${templateId}:${anno}:${idx}`;
}

