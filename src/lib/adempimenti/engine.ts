import "server-only";
import { Prisma, type AdempimentoTemplate } from "@prisma/client";
import { prisma } from "@/lib/db";
import { STATI_TASK_APERTI } from "@/lib/constants";
import { abbinaScadenze, calcolaScadenze, deveGenerare, isApplicabile, type AttivitaPresente, type ScadenzaCalcolata } from "@/lib/adempimenti/regole";

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

export interface DataDiversa {
  id: string;
  titolo: string;
  attuale: Date;
  catalogo: Date;
}

export interface EsitoPianificazione {
  creati: number;
  esistenti: number;
  /** attività aperte la cui data non coincide più con il catalogo: NON vengono toccate, si segnalano */
  dateDiverse: DataDiversa[];
  /** le attività nuove sono state create senza assegnatario */
  senzaAssegnatario: boolean;
  /** il cliente ha un referente, ma non è più attivo */
  referenteNonAttivo: boolean;
}

/**
 * Inserisce le attività nuove in un solo blocco. Se una chiave è già usata (pianificazione lanciata in
 * contemporanea, oppure un'attività generata e poi spostata a un altro cliente che si è portata dietro
 * la chiave) non fallisce tutto: libera le chiavi rimaste su attività di altri clienti, conta come già
 * presenti quelle di questo cliente, e riprova con il resto.
 */
async function inserisciGenerate(nuove: Prisma.TaskCreateManyInput[], clientId: string) {
  let daCreare = nuove;
  let giaPresenti = 0;
  // Libera o scarta le chiavi già usate; si fa PRIMA di inserire, così il caso normale non passa da un
  // errore di vincolo (che finirebbe nei log del server e allarmerebbe chi li legge).
  const scartaOccupate = async () => {
    const occupate = await prisma.task.findMany({
      where: { chiave: { in: daCreare.map((n) => n.chiave).filter((c): c is string => !!c) } },
      select: { id: true, chiave: true, clientId: true },
    });
    const altrove = occupate.filter((o) => o.clientId !== clientId);
    if (altrove.length) await prisma.task.updateMany({ where: { id: { in: altrove.map((o) => o.id) } }, data: { chiave: null } });
    const qui = new Set(occupate.filter((o) => o.clientId === clientId).map((o) => o.chiave));
    giaPresenti += qui.size;
    daCreare = daCreare.filter((n) => !qui.has(n.chiave ?? null));
  };
  await scartaOccupate();
  for (let tentativo = 0; tentativo < 3 && daCreare.length; tentativo++) {
    try {
      // transazione a lotto: l'inserimento è tutto o niente anche se Prisma lo spezza in più istruzioni
      await prisma.$transaction([prisma.task.createMany({ data: daCreare })]);
      return { creati: daCreare.length, giaPresenti };
    } catch (e) {
      // una pianificazione dello stesso cliente partita nello stesso istante: si riprova con il resto
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      await scartaOccupate();
    }
  }
  return { creati: 0, giaPresenti };
}

/**
 * Genera le attività di un anno per un cliente. Idempotente: le scadenze già presenti si riconoscono
 * con abbinaScadenze (per chiave, per periodo, per chiave vecchia o per giorno) e non vengono mai
 * modificate — nemmeno quando la data del catalogo è cambiata, perché quella presente può essere una
 * data concordata con il cliente: in quel caso si segnala, in dateDiverse.
 */
export async function pianificaAnno(opts: PianificaOpzioni): Promise<EsitoPianificazione> {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: opts.clientId }, include: { referente: { select: { attivo: true } } } });
  const [templates, overrides, presenti] = await Promise.all([
    prisma.adempimentoTemplate.findMany({ where: opts.templateIds ? { id: { in: opts.templateIds } } : { attivo: true } }),
    prisma.clientAdempimentoOverride.findMany({ where: { clientId: opts.clientId } }),
    prisma.task.findMany({
      where: { clientId: opts.clientId, anno: opts.anno, templateId: { not: null } },
      select: { id: true, chiave: true, templateId: true, periodo: true, scadenza: true, stato: true },
    }),
  ]);
  const ovMap = new Map(overrides.map((o) => [o.templateId, o]));
  const presentiPerTemplate = new Map<string, AttivitaPresente[]>();
  for (const p of presenti) presentiPerTemplate.set(p.templateId!, [...(presentiPerTemplate.get(p.templateId!) ?? []), p]);

  // un referente non più attivo non riceve nulla: meglio senza assegnatario (i promemoria vanno agli amministratori)
  const referenteAttivo = !!client.referenteId && !!client.referente?.attivo;
  const assigneeId = opts.assigneeId === undefined ? (referenteAttivo ? client.referenteId : null) : opts.assigneeId;
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  const nuove: Prisma.TaskCreateManyInput[] = [];
  const dateDiverse: DataDiversa[] = [];
  let esistenti = 0;
  for (const t of templates) {
    const forzato = !!opts.templateIds;
    if (!forzato && !deveGenerare(t, client, ovMap.get(t.id))) continue;
    if (forzato && ovMap.get(t.id)?.attivo === false) continue;
    const voci = calcolaScadenze(t, opts.anno).filter((s) => !(opts.saltaPassate && s.scadenza < oggi));
    for (const a of abbinaScadenze(voci, presentiPerTemplate.get(t.id) ?? [], { clientId: client.id, templateId: t.id, anno: opts.anno })) {
      if (a.presente) {
        esistenti++;
        const aperta = STATI_TASK_APERTI.includes(a.presente.stato as (typeof STATI_TASK_APERTI)[number]);
        if (aperta && a.presente.scadenza.toDateString() !== a.voce.scadenza.toDateString()) {
          dateDiverse.push({ id: a.presente.id, titolo: a.voce.titolo, attuale: a.presente.scadenza, catalogo: a.voce.scadenza });
        }
        continue;
      }
      nuove.push({
        titolo: a.voce.titolo,
        descrizione: t.descrizione,
        clientId: client.id,
        templateId: t.id,
        scadenza: a.voce.scadenza,
        anno: opts.anno,
        periodo: a.voce.periodo,
        chiave: a.chiave,
        assigneeId,
        createdById: opts.createdById ?? null,
        giorniPreavviso: t.giorniPreavviso,
        priorita: "MEDIA",
      });
    }
  }
  const { creati, giaPresenti } = nuove.length ? await inserisciGenerate(nuove, client.id) : { creati: 0, giaPresenti: 0 };
  return {
    creati,
    esistenti: esistenti + giaPresenti,
    dateDiverse,
    senzaAssegnatario: creati > 0 && !assigneeId,
    referenteNonAttivo: !!client.referenteId && !referenteAttivo,
  };
}
