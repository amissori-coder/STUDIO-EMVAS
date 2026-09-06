import "server-only";
import type { AdempimentoTemplate, Client } from "@prisma/client";
import { prisma } from "@/lib/db";
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

export interface AnteprimaVoce {
  template: AdempimentoTemplate;
  applicabile: boolean;
  override: boolean | null;
  generare: boolean;
  scadenze: ScadenzaCalcolata[];
  esistenti: number;
}

/** Anteprima della pianificazione di un anno per un cliente. */
export async function anteprimaPianificazione(clientId: string, anno: number): Promise<AnteprimaVoce[]> {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  const [templates, overrides, esistenti] = await Promise.all([
    prisma.adempimentoTemplate.findMany({ orderBy: [{ ordine: "asc" }, { nome: "asc" }] }),
    prisma.clientAdempimentoOverride.findMany({ where: { clientId } }),
    prisma.task.groupBy({ by: ["templateId"], where: { clientId, anno, templateId: { not: null } }, _count: { _all: true } }),
  ]);
  const ovMap = new Map(overrides.map((o) => [o.templateId, o]));
  const exMap = new Map(esistenti.map((e) => [e.templateId, e._count._all]));
  return templates.map((t) => {
    const ov = ovMap.get(t.id) ?? null;
    return {
      template: t,
      applicabile: isApplicabile(t, client),
      override: ov ? ov.attivo : null,
      generare: deveGenerare(t, client, ov),
      scadenze: calcolaScadenze(t, anno),
      esistenti: exMap.get(t.id) ?? 0,
    };
  });
}

export interface PianificaOpzioni {
  clientId: string;
  anno: number;
  createdById?: string | null;
  /** Se indicato, genera solo questi template (altrimenti tutti quelli "da generare"). */
  templateIds?: string[];
  /** Assegnatario delle attività (default: referente del cliente). */
  assigneeId?: string | null;
  /** Se true, non genera scadenze già passate. */
  saltaPassate?: boolean;
}

/** Genera le attività di un anno per un cliente. Idempotente (chiave univoca per scadenza). */
export async function pianificaAnno(opts: PianificaOpzioni) {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: opts.clientId } });
  const [templates, overrides] = await Promise.all([
    prisma.adempimentoTemplate.findMany({ where: opts.templateIds ? { id: { in: opts.templateIds } } : { attivo: true } }),
    prisma.clientAdempimentoOverride.findMany({ where: { clientId: opts.clientId } }),
  ]);
  const ovMap = new Map(overrides.map((o) => [o.templateId, o]));
  const assigneeId = opts.assigneeId === undefined ? client.referenteId : opts.assigneeId;
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  let creati = 0;
  let esistenti = 0;
  for (const t of templates) {
    const forzato = !!opts.templateIds;
    if (!forzato && !deveGenerare(t, client, ovMap.get(t.id))) continue;
    if (forzato && ovMap.get(t.id)?.attivo === false) continue;
    for (const s of calcolaScadenze(t, opts.anno)) {
      if (opts.saltaPassate && s.scadenza < oggi) continue;
      const chiave = chiaveTask(client.id, t.id, opts.anno, s.idx);
      const found = await prisma.task.findUnique({ where: { chiave }, select: { id: true } });
      if (found) { esistenti++; continue; }
      await prisma.task.create({
        data: {
          titolo: s.titolo,
          descrizione: t.descrizione,
          clientId: client.id,
          templateId: t.id,
          scadenza: s.scadenza,
          anno: opts.anno,
          periodo: s.periodo,
          chiave,
          assigneeId,
          createdById: opts.createdById ?? null,
          giorniPreavviso: t.giorniPreavviso,
          priorita: "MEDIA",
        },
      });
      creati++;
    }
  }
  return { creati, esistenti };
}
