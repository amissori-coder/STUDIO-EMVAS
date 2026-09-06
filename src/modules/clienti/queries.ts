import "server-only";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { RUOLI_STAFF, STATI_TASK_APERTI } from "@/lib/constants";
import { startOfDayLocal } from "@/lib/utils";

export type ClientWithReferente = Prisma.ClientGetPayload<{ include: { referente: { select: { id: true; nome: true; colore: true; email: true } } } }>;

/** Carica il cliente (con referente) oppure restituisce 404. */
export async function getClientOrNotFound(id: string): Promise<ClientWithReferente> {
  const client = await prisma.client.findUnique({
    where: { id },
    include: { referente: { select: { id: true, nome: true, colore: true, email: true } } },
  });
  if (!client) notFound();
  return client;
}

/** Utenti staff attivi (per la scelta del referente). */
export async function getStaffUsers() {
  return prisma.user.findMany({
    where: { ruolo: { in: RUOLI_STAFF }, attivo: true },
    select: { id: true, nome: true, colore: true, ruolo: true },
    orderBy: { nome: "asc" },
  });
}

export interface ClientListFilters {
  q?: string;
  regime?: string;
  tipo?: string;
  referente?: string;
  stato?: "attivi" | "archiviati" | "tutti";
}

export async function listClients(filters: ClientListFilters) {
  const where: Prisma.ClientWhereInput = {};
  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { denominazione: { contains: q } },
      { partitaIva: { contains: q } },
      { codiceFiscale: { contains: q.toUpperCase() } },
      { email: { contains: q.toLowerCase() } },
      { pec: { contains: q.toLowerCase() } },
    ];
  }
  if (filters.regime) where.regimeFiscale = filters.regime;
  if (filters.tipo) where.tipoSoggetto = filters.tipo;
  if (filters.referente === "nessuno") where.referenteId = null;
  else if (filters.referente) where.referenteId = filters.referente;
  const stato = filters.stato ?? "attivi";
  if (stato === "attivi") where.attivo = true;
  else if (stato === "archiviati") where.attivo = false;

  const clients = await prisma.client.findMany({
    where,
    orderBy: { denominazione: "asc" },
    include: { referente: { select: { id: true, nome: true, colore: true } } },
  });

  const ids = clients.map((c) => c.id);
  const oggi = startOfDayLocal(new Date());
  const [aperte, scadute] = ids.length
    ? await Promise.all([
        prisma.task.groupBy({ by: ["clientId"], where: { clientId: { in: ids }, stato: { in: STATI_TASK_APERTI } }, _count: { _all: true } }),
        prisma.task.groupBy({
          by: ["clientId"],
          where: { clientId: { in: ids }, stato: { in: STATI_TASK_APERTI }, scadenza: { lt: oggi } },
          _count: { _all: true },
        }),
      ])
    : [[], []];
  const aperteMap = new Map(aperte.map((r) => [r.clientId, r._count._all]));
  const scaduteMap = new Map(scadute.map((r) => [r.clientId, r._count._all]));

  return clients.map((c) => ({
    ...c,
    taskAperte: aperteMap.get(c.id) ?? 0,
    taskScadute: scaduteMap.get(c.id) ?? 0,
  }));
}

export type ClientListRow = Awaited<ReturnType<typeof listClients>>[number];

/** Dati per la card "Riepilogo" della scheda cliente. */
export async function getClientSummary(clientId: string) {
  const oggi = startOfDayLocal(new Date());
  const [taskAperte, taskScadute, prossime, ultimaEmail, contatti, utenti] = await Promise.all([
    prisma.task.count({ where: { clientId, stato: { in: STATI_TASK_APERTI } } }),
    prisma.task.count({ where: { clientId, stato: { in: STATI_TASK_APERTI }, scadenza: { lt: oggi } } }),
    prisma.task.findMany({
      where: { clientId, stato: { in: STATI_TASK_APERTI }, scadenza: { gte: oggi } },
      orderBy: { scadenza: "asc" },
      take: 3,
      select: { id: true, titolo: true, scadenza: true, stato: true, priorita: true },
    }),
    prisma.emailMessage.findFirst({ where: { clientId }, orderBy: { receivedAt: "desc" }, select: { id: true, receivedAt: true, subject: true } }),
    prisma.clientContact.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } }),
    prisma.clientUser.findMany({
      where: { clientId },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, nome: true, email: true, attivo: true, lastLoginAt: true, colore: true } } },
    }),
  ]);
  return { taskAperte, taskScadute, prossime, ultimaEmail, contatti, utenti };
}

export type ClientContactRow = Awaited<ReturnType<typeof getClientSummary>>["contatti"][number];
export type ClientPortalUserRow = Awaited<ReturnType<typeof getClientSummary>>["utenti"][number];
