import "server-only";
import type { AdempimentoTemplate } from "@prisma/client";
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
