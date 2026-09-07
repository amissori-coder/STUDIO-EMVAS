import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { safeJsonParse } from "@/lib/utils";
import type { ParsedAttachment } from "@/lib/gmail";

export const EMAIL_PAGE_SIZE = 50;

export const VISTE_EMAIL = {
  "da-associare": "Da associare",
  tutte: "Tutte",
  "con-allegati": "Con allegati",
  archiviate: "Archiviate",
} as const;
export type VistaEmail = keyof typeof VISTE_EMAIL;

export interface EmailListFilters {
  vista: VistaEmail;
  cliente?: string;
  casella?: string;
  q?: string;
  pagina: number;
}

export function parseEmailFilters(sp: Record<string, string | string[] | undefined>): EmailListFilters {
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const vistaRaw = str("vista");
  const vista: VistaEmail = vistaRaw in VISTE_EMAIL ? (vistaRaw as VistaEmail) : "da-associare";
  const pagina = Math.max(1, Number.parseInt(str("pagina") || "1", 10) || 1);
  return {
    vista,
    cliente: str("cliente") || undefined,
    casella: str("casella") || undefined,
    q: str("q") || undefined,
    pagina,
  };
}

export function buildEmailWhere(f: EmailListFilters): Prisma.EmailMessageWhereInput {
  const where: Prisma.EmailMessageWhereInput = {};
  switch (f.vista) {
    case "da-associare":
      where.clientId = null;
      where.archiviata = false;
      break;
    case "archiviate":
      where.archiviata = true;
      break;
    case "con-allegati":
      where.hasAttachments = true;
      where.archiviata = false;
      break;
    case "tutte":
      where.archiviata = false;
      break;
  }
  if (f.cliente) {
    // Con il filtro cliente la vista "da associare" non ha senso: mostro le email del cliente non archiviate
    where.clientId = f.cliente;
    if (f.vista === "da-associare") where.archiviata = false;
  }
  if (f.casella) where.accountId = f.casella;
  if (f.q) {
    where.OR = [
      { subject: { contains: f.q } },
      { fromAddr: { contains: f.q } },
      { fromName: { contains: f.q } },
      { snippet: { contains: f.q } },
    ];
  }
  return where;
}

export const emailListSelect = {
  id: true,
  fromAddr: true,
  fromName: true,
  subject: true,
  snippet: true,
  receivedAt: true,
  hasAttachments: true,
  isUnread: true,
  archiviata: true,
  linkAuto: true,
  clientId: true,
  taskId: true,
  client: { select: { id: true, denominazione: true } },
  task: { select: { id: true, titolo: true } },
  account: { select: { id: true, googleEmail: true } },
} satisfies Prisma.EmailMessageSelect;

export type EmailListItem = Prisma.EmailMessageGetPayload<{ select: typeof emailListSelect }>;

export async function listEmails(f: EmailListFilters) {
  const where = buildEmailWhere(f);
  const [items, total] = await Promise.all([
    prisma.emailMessage.findMany({
      where,
      select: emailListSelect,
      orderBy: { receivedAt: "desc" },
      skip: (f.pagina - 1) * EMAIL_PAGE_SIZE,
      take: EMAIL_PAGE_SIZE,
    }),
    prisma.emailMessage.count({ where }),
  ]);
  return { items, total, pages: Math.max(1, Math.ceil(total / EMAIL_PAGE_SIZE)) };
}

export async function listGoogleAccounts() {
  return prisma.googleAccount.findMany({
    select: { id: true, googleEmail: true, lastSyncAt: true, syncError: true, userId: true, user: { select: { nome: true } } },
    orderBy: { googleEmail: "asc" },
  });
}

export async function listActiveClientsForSelect() {
  return prisma.client.findMany({
    where: { attivo: true },
    select: { id: true, denominazione: true },
    orderBy: { denominazione: "asc" },
  });
}

export function parseAttachments(raw: string | null | undefined): ParsedAttachment[] {
  const list = safeJsonParse<unknown>(raw, []);
  if (!Array.isArray(list)) return [];
  return list
    .filter((a): a is ParsedAttachment => !!a && typeof a === "object" && typeof (a as ParsedAttachment).attachmentId === "string")
    .map((a) => ({
      filename: String(a.filename ?? "allegato"),
      mimeType: String(a.mimeType ?? "application/octet-stream"),
      size: Number(a.size ?? 0) || 0,
      attachmentId: a.attachmentId,
      ...(typeof a.partId === "string" ? { partId: a.partId } : {}),
    }));
}

export function splitAddresses(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function getEmailDetail(id: string) {
  return prisma.emailMessage.findUnique({
    where: { id },
    include: {
      account: { select: { id: true, googleEmail: true, user: { select: { nome: true } } } },
      client: { select: { id: true, denominazione: true, referenteId: true } },
      task: { select: { id: true, titolo: true, stato: true, scadenza: true } },
      linkedBy: { select: { nome: true } },
      documenti: { select: { id: true, nome: true, folderId: true, createdAt: true }, orderBy: { createdAt: "desc" } },
    },
  });
}

export type EmailDetail = NonNullable<Awaited<ReturnType<typeof getEmailDetail>>>;

export async function listEmailsForClient(clientId: string, limit = 50) {
  return prisma.emailMessage.findMany({
    where: { clientId },
    select: emailListSelect,
    orderBy: { receivedAt: "desc" },
    take: limit,
  });
}
