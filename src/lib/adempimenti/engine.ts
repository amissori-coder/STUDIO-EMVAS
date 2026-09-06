import "server-only";
import type { AdempimentoTemplate, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { calcolaScadenze, chiaveTask, deveGenerare, isApplicabile, type ScadenzaCalcolata } from "@/lib/adempimenti/regole";

export * from "@/lib/adempimenti/regole";

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

function giornoKey(templateId: string, d: Date) {
  return `${templateId}:${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Genera le attività di un anno per un cliente. Idempotente: una scadenza è considerata già presente se esiste
 * un'attività con la stessa chiave (cliente:template:anno:idx) oppure, per lo stesso template e anno, con la
 * stessa data di scadenza (copre le attività create con il vecchio schema di chiavi posizionali).
 * Le chiavi esistenti vengono caricate una volta sola e le nuove attività inserite in blocco.
 */
export async function pianificaAnno(opts: PianificaOpzioni) {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: opts.clientId } });
  const [templates, overrides, presenti] = await Promise.all([
    prisma.adempimentoTemplate.findMany({ where: opts.templateIds ? { id: { in: opts.templateIds } } : { attivo: true } }),
    prisma.clientAdempimentoOverride.findMany({ where: { clientId: opts.clientId } }),
    prisma.task.findMany({
      where: { clientId: opts.clientId, anno: opts.anno, templateId: { not: null } },
      select: { chiave: true, templateId: true, scadenza: true },
    }),
  ]);
  const ovMap = new Map(overrides.map((o) => [o.templateId, o]));
  const chiaviPresenti = new Set(presenti.map((p) => p.chiave).filter((c): c is string => !!c));
  const giorniPresenti = new Set(presenti.map((p) => giornoKey(p.templateId!, p.scadenza)));
  const assigneeId = opts.assigneeId === undefined ? client.referenteId : opts.assigneeId;
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  const nuove: Prisma.TaskCreateManyInput[] = [];
  let esistenti = 0;
  for (const t of templates) {
    const forzato = !!opts.templateIds;
    if (!forzato && !deveGenerare(t, client, ovMap.get(t.id))) continue;
    if (forzato && ovMap.get(t.id)?.attivo === false) continue;
    for (const s of calcolaScadenze(t, opts.anno)) {
      if (opts.saltaPassate && s.scadenza < oggi) continue;
      const chiave = chiaveTask(client.id, t.id, opts.anno, s.idx);
      const gk = giornoKey(t.id, s.scadenza);
      if (chiaviPresenti.has(chiave) || giorniPresenti.has(gk)) { esistenti++; continue; }
      chiaviPresenti.add(chiave);
      giorniPresenti.add(gk);
      nuove.push({
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
      });
    }
  }
  if (nuove.length) await prisma.task.createMany({ data: nuove });
  return { creati: nuove.length, esistenti };
}
