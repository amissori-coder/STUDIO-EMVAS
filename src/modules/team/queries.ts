import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { RUOLI_STAFF, STATI_TASK_APERTI } from "@/lib/constants";
import { addDays, endOfDayLocal, formatDate, formatRelative, startOfDayLocal } from "@/lib/utils";
import { parseMese, type AbsenceFilters } from "./absence-filters";

export { parseAbsenceFilters, parseMese, buildAbsenceQuery, type AbsenceFilters } from "./absence-filters";

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------
export interface StaffRow {
  id: string;
  nome: string;
  email: string;
  ruolo: string;
  colore: string;
  telefono: string | null;
  attivo: boolean;
  hasGoogle: boolean;
  googleEmail: string | null;
  lastLoginAt: string | null;
  /** etichetta relativa calcolata sul server (evita differenze di fuso tra server e browser) */
  lastLoginLabel: string;
  createdAt: string;
  /** scadenza dell'invito ancora aperto (ISO), null se non c'è un invito pendente */
  inviteExpires: string | null;
  hasPassword: boolean;
  taskAperte: number;
  taskScadute: number;
  /** assenza approvata che copre oggi */
  assenzaOggi: { tipo: string; dataFine: string; fineLabel: string } | null;
}

export async function listStaff(): Promise<StaffRow[]> {
  const oggi = startOfDayLocal(new Date());
  const [users, aperte, scadute, assenze] = await Promise.all([
    prisma.user.findMany({
      where: { ruolo: { in: RUOLI_STAFF } },
      include: { googleAccount: { select: { googleEmail: true } } },
      orderBy: [{ attivo: "desc" }, { ruolo: "asc" }, { nome: "asc" }],
    }),
    prisma.task.groupBy({ by: ["assigneeId"], where: { stato: { in: STATI_TASK_APERTI }, assigneeId: { not: null } }, _count: { _all: true } }),
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: { stato: { in: STATI_TASK_APERTI }, assigneeId: { not: null }, scadenza: { lt: oggi } },
      _count: { _all: true },
    }),
    prisma.absence.findMany({
      where: { stato: "APPROVATA", dataInizio: { lte: endOfDayLocal(oggi) }, dataFine: { gte: oggi } },
      select: { userId: true, tipo: true, dataFine: true },
      orderBy: { dataFine: "desc" },
    }),
  ]);
  const aperteMap = new Map(aperte.map((r) => [r.assigneeId, r._count._all]));
  const scaduteMap = new Map(scadute.map((r) => [r.assigneeId, r._count._all]));
  const assenzaMap = new Map<string, { tipo: string; dataFine: string; fineLabel: string }>();
  for (const a of assenze) if (!assenzaMap.has(a.userId)) assenzaMap.set(a.userId, { tipo: a.tipo, dataFine: a.dataFine.toISOString(), fineLabel: formatDate(a.dataFine) });

  return users.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    ruolo: u.ruolo,
    colore: u.colore,
    telefono: u.telefono,
    attivo: u.attivo,
    hasGoogle: !!u.googleAccount,
    googleEmail: u.googleAccount?.googleEmail ?? null,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    lastLoginLabel: u.lastLoginAt ? `Ultimo accesso ${formatRelative(u.lastLoginAt)}` : "Non ha ancora effettuato l'accesso",
    createdAt: u.createdAt.toISOString(),
    inviteExpires: u.inviteToken && u.inviteExpires ? u.inviteExpires.toISOString() : null,
    hasPassword: !!u.passwordHash,
    taskAperte: aperteMap.get(u.id) ?? 0,
    taskScadute: scaduteMap.get(u.id) ?? 0,
    assenzaOggi: assenzaMap.get(u.id) ?? null,
  }));
}

export async function getStaffOptions() {
  return prisma.user.findMany({
    where: { ruolo: { in: RUOLI_STAFF }, attivo: true },
    select: { id: true, nome: true, colore: true },
    orderBy: { nome: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Assenze
// ---------------------------------------------------------------------------
export const ABSENCE_INCLUDE = {
  user: { select: { id: true, nome: true, colore: true, attivo: true } },
  approvedBy: { select: { id: true, nome: true } },
} satisfies Prisma.AbsenceInclude;

export type AbsenceRecord = Prisma.AbsenceGetPayload<{ include: typeof ABSENCE_INCLUDE }>;

export type AbsenceItem = AbsenceRecord & {
  /** attività aperte assegnate all'utente in scadenza durante l'assenza (o già scadute) */
  taskARischio: number;
};

/** Conta, per ogni assenza, le attività aperte dell'utente in scadenza nel periodo (o già scadute). */
export async function conteggioTaskARischio<T extends { id: string; userId: string; dataInizio: Date; dataFine: Date }>(assenze: T[]) {
  const out = new Map<string, number>();
  const userIds = Array.from(new Set(assenze.map((a) => a.userId)));
  if (!userIds.length) return out;
  const maxFine = assenze.reduce((max, a) => (a.dataFine > max ? a.dataFine : max), assenze[0]!.dataFine);
  const tasks = await prisma.task.findMany({
    where: { assigneeId: { in: userIds }, stato: { in: STATI_TASK_APERTI }, scadenza: { lte: endOfDayLocal(maxFine) } },
    select: { assigneeId: true, scadenza: true },
  });
  const oggi = startOfDayLocal(new Date());
  for (const a of assenze) {
    const inizio = startOfDayLocal(a.dataInizio);
    const fine = endOfDayLocal(a.dataFine);
    const n = tasks.filter((t) => t.assigneeId === a.userId && t.scadenza <= fine && (t.scadenza >= inizio || t.scadenza < oggi)).length;
    out.set(a.id, n);
  }
  return out;
}

/** Assenze che intersecano il mese indicato (con filtri). */
export async function listAbsencesForMonth(f: AbsenceFilters): Promise<AbsenceItem[]> {
  const { anno, mese } = parseMese(f.mese);
  const inizioMese = new Date(anno, mese - 1, 1, 0, 0, 0, 0);
  const fineMese = new Date(anno, mese, 0, 23, 59, 59, 999);
  const where: Prisma.AbsenceWhereInput = { dataInizio: { lte: fineMese }, dataFine: { gte: inizioMese } };
  if (f.utente) where.userId = f.utente;
  if (f.stato) where.stato = f.stato;
  const assenze = await prisma.absence.findMany({ where, include: ABSENCE_INCLUDE, orderBy: [{ dataInizio: "asc" }, { createdAt: "asc" }] });
  const rischio = await conteggioTaskARischio(assenze);
  return assenze.map((a) => ({ ...a, taskARischio: rischio.get(a.id) ?? 0 }));
}

/** Assenze approvate che coprono oggi. */
export async function listAbsentToday() {
  const oggi = startOfDayLocal(new Date());
  return prisma.absence.findMany({
    where: { stato: "APPROVATA", dataInizio: { lte: endOfDayLocal(oggi) }, dataFine: { gte: oggi }, user: { attivo: true } },
    include: ABSENCE_INCLUDE,
    orderBy: { dataFine: "asc" },
  });
}

/** Assenze approvate che intersecano [oggi, oggi+giorni]. */
export async function listAbsencesInWindow(giorni: number) {
  const oggi = startOfDayLocal(new Date());
  return prisma.absence.findMany({
    where: { stato: "APPROVATA", dataInizio: { lte: endOfDayLocal(addDays(oggi, giorni)) }, dataFine: { gte: oggi }, user: { attivo: true } },
    include: ABSENCE_INCLUDE,
    orderBy: { dataInizio: "asc" },
  });
}

export async function countPendingAbsences() {
  return prisma.absence.count({ where: { stato: "RICHIESTA" } });
}
