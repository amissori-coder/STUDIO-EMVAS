// Regole pure (senza accesso al DB) per applicabilità e calcolo delle scadenze degli adempimenti.
import type { AdempimentoTemplate, Client } from "@prisma/client";
import { safeJsonParse } from "@/lib/utils";
import { MESI, scadenzaEffettiva, ultimoGiornoMese } from "@/lib/adempimenti/calendario";
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

/** Sostituisce i segnaposto {anno}, {annoPrec} (anno-1) e {annoPrec2} (anno-2). */
export function sostituisciAnno(s: string, anno: number) {
  return s
    .replace(/\{anno\}/g, String(anno))
    .replace(/\{annoPrec2\}/g, String(anno - 2))
    .replace(/\{annoPrec\}/g, String(anno - 1));
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

/**
 * Calcola le scadenze di un adempimento per un anno (date già prorogate a Ferragosto e spostate al primo
 * giorno lavorativo). L'indice `idx` è stabile rispetto alle modifiche del template: per le ricorrenze
 * mensili è il mese (1-12), per le voci fisse è mese*100+giorno (es. 16 febbraio -> 216), così la chiave
 * di deduplica non dipende dalla posizione della riga.
 */
export function calcolaScadenze(t: AdempimentoTemplate, anno: number): ScadenzaCalcolata[] {
  const regole = safeJsonParse<ScadenzaRegola[]>(t.scadenze, []);
  const out: ScadenzaCalcolata[] = [];

  if (t.ricorrenza === "MENSILE") {
    const regola = (regole[0] ?? { giorno: 16, offsetMeseCompetenza: -1 }) as ScadenzaMensile;
    const offset = regola.offsetMeseCompetenza ?? -1;
    for (let mese = 1; mese <= 12; mese++) {
      const giorno = regola.giorno === 0 ? ultimoGiornoMese(anno, mese) : Math.min(regola.giorno, ultimoGiornoMese(anno, mese));
      const data = scadenzaEffettiva(new Date(anno, mese - 1, giorno, 12));
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

  const usati = new Set<number>();
  regole.forEach((r) => {
    const f = r as ScadenzaFissa;
    if (!f.mese) return;
    const giorno = f.giorno === 0 ? ultimoGiornoMese(anno, f.mese) : Math.min(f.giorno, ultimoGiornoMese(anno, f.mese));
    const data = scadenzaEffettiva(new Date(anno, f.mese - 1, giorno, 12));
    const periodo = f.etichetta ? sostituisciAnno(f.etichetta, anno) : `${anno}`;
    let idx = f.mese * 100 + (f.giorno ?? 0);
    while (usati.has(idx)) idx += 10_000; // due voci nello stesso giorno (raro): indice comunque univoco
    usati.add(idx);
    out.push({ idx, scadenza: data, periodo, titolo: f.etichetta ? `${t.nome} – ${periodo}` : t.nome });
  });
  return out.sort((a, b) => a.scadenza.getTime() - b.scadenza.getTime());
}

export function chiaveTask(clientId: string, templateId: string, anno: number, idx: number) {
  return `${clientId}:${templateId}:${anno}:${idx}`;
}


/**
 * Chiave stabile di un'attività generata: dipende dal PERIODO a cui si riferisce la scadenza («Gennaio
 * 2027», «Saldo 2026»…), non dalla data. Le date cambiano per legge e il commercialista le corregge nel
 * catalogo; con la data dentro la chiave ogni correzione faceva nascere un doppione e lasciava aperta
 * l'attività con la data vecchia. `occorrenza` distingue più voci con lo stesso periodo.
 */
export function chiaveStabile(clientId: string, templateId: string, anno: number, periodo: string, occorrenza: number) {
  return `${clientId}:${templateId}:${anno}:p:${periodo}#${occorrenza}`;
}

export interface AttivitaPresente {
  id: string;
  chiave: string | null;
  periodo: string | null;
  scadenza: Date;
  stato: string;
}

export interface VoceAbbinata {
  voce: ScadenzaCalcolata;
  chiave: string;
  /** attività già esistente per questa scadenza, oppure null se va creata */
  presente: AttivitaPresente | null;
}

function stessoGiorno(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Abbina le scadenze calcolate di UN adempimento per un cliente e un anno alle attività già presenti.
 * Per ogni scadenza, nell'ordine:
 *  1. stessa chiave stabile (attività generate da questa versione);
 *  2. stesso periodo, abbinando la prima con la prima, la seconda con la seconda (generate prima, con
 *     la chiave che conteneva la data: così una data corretta nel catalogo non fa nascere un doppione);
 *  3. stessa chiave del vecchio schema (mese*100+giorno);
 *  4. un'attività senza periodo dello stesso adempimento nello stesso giorno (scritta a mano):
 *     non si crea un doppione accanto a lei.
 * Un'attività presente viene abbinata al massimo una volta: due scadenze nello stesso giorno restano due.
 * L'abbinamento serve SOLO a non creare doppioni: le attività presenti non vengono mai modificate.
 */
export function abbinaScadenze(
  voci: ScadenzaCalcolata[],
  presenti: AttivitaPresente[],
  ctx: { clientId: string; templateId: string; anno: number },
): VoceAbbinata[] {
  const usate = new Set<string>();
  const libera = (p: AttivitaPresente | undefined) => (p && !usate.has(p.id) ? p : undefined);
  const occorrenze = new Map<string, number>();
  const perPeriodo = new Map<string, AttivitaPresente[]>();
  for (const p of [...presenti].sort((a, b) => a.scadenza.getTime() - b.scadenza.getTime())) {
    if (!p.periodo) continue;
    perPeriodo.set(p.periodo, [...(perPeriodo.get(p.periodo) ?? []), p]);
  }

  return voci.map((voce) => {
    const n = (occorrenze.get(voce.periodo) ?? 0) + 1;
    occorrenze.set(voce.periodo, n);
    const chiave = chiaveStabile(ctx.clientId, ctx.templateId, ctx.anno, voce.periodo, n);
    const vecchia = chiaveTask(ctx.clientId, ctx.templateId, ctx.anno, voce.idx);
    const trovata =
      libera(presenti.find((p) => p.chiave === chiave)) ??
      libera((perPeriodo.get(voce.periodo) ?? []).filter((p) => !usate.has(p.id))[0]) ??
      libera(presenti.find((p) => p.chiave === vecchia)) ??
      libera(presenti.find((p) => !p.periodo && !usate.has(p.id) && stessoGiorno(p.scadenza, voce.scadenza)));
    if (trovata) usate.add(trovata.id);
    return { voce, chiave, presente: trovata ?? null };
  });
}
