import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/guards";
import { STATI_TASK_APERTI } from "@/lib/constants";
import { addDays, endOfDayLocal, startOfDayLocal } from "@/lib/utils";
import { ABSENCE_INCLUDE, type AbsenceRecord } from "./queries";

export const DASH_TASK_INCLUDE = {
  client: { select: { id: true, denominazione: true } },
  assignee: { select: { id: true, nome: true, colore: true } },
} satisfies Prisma.TaskInclude;
export type DashTask = Prisma.TaskGetPayload<{ include: typeof DASH_TASK_INCLUDE }>;

export interface AllertaAssenza {
  assenza: AbsenceRecord;
  /** attività aperte dell'assente in scadenza nella finestra (o già scadute) */
  tasks: DashTask[];
  totale: number;
}

export interface DashboardData {
  oggi: Date;
  kpi: {
    scaduteMie: number;
    scaduteTotali: number;
    oggiMie: number;
    oggiTotali: number;
    settimanaMie: number;
    settimanaTotali: number;
    emailDaAssociare: number;
    chatNonLette: number;
    documentiClienti7g: number;
    assenzeInAttesa: number;
  };
  mieAttivita: DashTask[];
  allerte: AllertaAssenza[];
  assentiSettimana: AbsenceRecord[];
  ultimeEmail: { id: string; subject: string; fromName: string | null; fromAddr: string; receivedAt: Date; client: { id: string; denominazione: string } | null }[];
  ultimiDocumenti: { id: string; nome: string; createdAt: Date; client: { id: string; denominazione: string }; uploadedBy: { nome: string } | null }[];
  prossimeScadenze: DashTask[];
  prossimeScadenzeTotale: number;
  /** solo admin: true se per l'anno corrente non è stata generata nessuna attività da adempimenti */
  pianificazioneMancante: boolean;
}

async function chatNonLette(userId: string) {
  const reads = await prisma.chatRead.findMany({ where: { userId }, select: { clientId: true, lastReadAt: true } });
  const groups = await prisma.chatMessage.groupBy({
    by: ["clientId"],
    where: {
      authorId: { not: userId },
      OR: [...reads.map((r) => ({ clientId: r.clientId, createdAt: { gt: r.lastReadAt } })), { clientId: { notIn: reads.map((r) => r.clientId) } }],
    },
    _count: { _all: true },
  });
  return groups.length;
}

export async function loadDashboard(user: CurrentUser): Promise<DashboardData> {
  const oggi = startOfDayLocal(new Date());
  const fineOggi = endOfDayLocal(oggi);
  const fineSettimana = endOfDayLocal(addDays(oggi, 7));
  const aperte = { stato: { in: STATI_TASK_APERTI } } as const;
  const isAdmin = user.ruolo === "ADMIN";
  const anno = oggi.getFullYear();
  const orizzonteAllerta = endOfDayLocal(addDays(oggi, 3));

  const [
    scaduteMie,
    scaduteTotali,
    oggiMie,
    oggiTotali,
    settimanaMie,
    settimanaTotali,
    emailDaAssociare,
    chat,
    documentiClienti7g,
    assenzeInAttesa,
    mieAttivita,
    assenzeAllerta,
    assentiSettimana,
    ultimeEmail,
    ultimiDocumenti,
    prossimeScadenze,
    prossimeScadenzeTotale,
    taskGenerateAnno,
  ] = await Promise.all([
    prisma.task.count({ where: { ...aperte, assigneeId: user.id, scadenza: { lt: oggi } } }),
    prisma.task.count({ where: { ...aperte, scadenza: { lt: oggi } } }),
    prisma.task.count({ where: { ...aperte, assigneeId: user.id, scadenza: { gte: oggi, lte: fineOggi } } }),
    prisma.task.count({ where: { ...aperte, scadenza: { gte: oggi, lte: fineOggi } } }),
    prisma.task.count({ where: { ...aperte, assigneeId: user.id, scadenza: { gte: oggi, lte: fineSettimana } } }),
    prisma.task.count({ where: { ...aperte, scadenza: { gte: oggi, lte: fineSettimana } } }),
    prisma.emailMessage.count({ where: { clientId: null, archiviata: false } }),
    chatNonLette(user.id),
    prisma.document.count({ where: { daCliente: true, createdAt: { gte: addDays(oggi, -7) } } }),
    isAdmin ? prisma.absence.count({ where: { stato: "RICHIESTA" } }) : Promise.resolve(0),
    prisma.task.findMany({
      where: { ...aperte, assigneeId: user.id, scadenza: { lte: fineSettimana } },
      include: DASH_TASK_INCLUDE,
      orderBy: [{ scadenza: "asc" }, { priorita: "desc" }],
      take: 15,
    }),
    prisma.absence.findMany({
      where: { stato: "APPROVATA", dataInizio: { lte: orizzonteAllerta }, dataFine: { gte: oggi }, user: { attivo: true } },
      include: ABSENCE_INCLUDE,
      orderBy: { dataInizio: "asc" },
    }),
    prisma.absence.findMany({
      where: { stato: "APPROVATA", dataInizio: { lte: fineSettimana }, dataFine: { gte: oggi }, user: { attivo: true } },
      include: ABSENCE_INCLUDE,
      orderBy: { dataInizio: "asc" },
    }),
    prisma.emailMessage.findMany({
      where: { clientId: { not: null }, archiviata: false },
      select: { id: true, subject: true, fromName: true, fromAddr: true, receivedAt: true, client: { select: { id: true, denominazione: true } } },
      orderBy: { receivedAt: "desc" },
      take: 5,
    }),
    prisma.document.findMany({
      where: { daCliente: true },
      select: { id: true, nome: true, createdAt: true, client: { select: { id: true, denominazione: true } }, uploadedBy: { select: { nome: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.task.findMany({
      where: { ...aperte, scadenza: { gte: oggi, lte: fineSettimana } },
      include: DASH_TASK_INCLUDE,
      orderBy: [{ scadenza: "asc" }, { priorita: "desc" }],
      take: 10,
    }),
    prisma.task.count({ where: { ...aperte, scadenza: { gte: oggi, lte: fineSettimana } } }),
    isAdmin ? prisma.task.count({ where: { templateId: { not: null }, anno } }) : Promise.resolve(1),
  ]);

  // Allerta assenze: per ogni assente (oggi..+3 giorni) le attività aperte in scadenza nella finestra o già scadute
  const allerte: AllertaAssenza[] = [];
  if (assenzeAllerta.length) {
    const userIds = Array.from(new Set(assenzeAllerta.map((a) => a.userId)));
    const tasks = await prisma.task.findMany({
      where: { ...aperte, assigneeId: { in: userIds }, scadenza: { lte: orizzonteAllerta } },
      include: DASH_TASK_INCLUDE,
      orderBy: { scadenza: "asc" },
    });
    for (const a of assenzeAllerta) {
      const finestraFine = endOfDayLocal(a.dataFine < orizzonteAllerta ? a.dataFine : orizzonteAllerta);
      const mine = tasks.filter((t) => t.assigneeId === a.userId && t.scadenza <= finestraFine);
      if (mine.length) allerte.push({ assenza: a, tasks: mine.slice(0, 5), totale: mine.length });
    }
  }

  return {
    oggi,
    kpi: {
      scaduteMie,
      scaduteTotali,
      oggiMie,
      oggiTotali,
      settimanaMie,
      settimanaTotali,
      emailDaAssociare,
      chatNonLette: chat,
      documentiClienti7g,
      assenzeInAttesa,
    },
    mieAttivita,
    allerte,
    assentiSettimana,
    ultimeEmail,
    ultimiDocumenti,
    prossimeScadenze,
    prossimeScadenzeTotale,
    pianificazioneMancante: isAdmin && taskGenerateAnno === 0,
  };
}
