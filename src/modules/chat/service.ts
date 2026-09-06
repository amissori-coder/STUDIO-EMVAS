import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { notify, notifyMany } from "@/lib/notifications";
import { RUOLI_STAFF } from "@/lib/constants";
import { truncate } from "@/lib/utils";

export const CHAT_MAX_LEN = 4000;
export const CHAT_INITIAL_LIMIT = 200;

export const chatMessageSelect = {
  id: true,
  clientId: true,
  testo: true,
  createdAt: true,
  author: { select: { id: true, nome: true, colore: true } },
} satisfies Prisma.ChatMessageSelect;

export type ChatMessageRow = Prisma.ChatMessageGetPayload<{ select: typeof chatMessageSelect }>;

/** Messaggio serializzato per i client component (date in ISO). */
export interface ChatMessageDto {
  id: string;
  clientId: string;
  testo: string;
  createdAt: string;
  author: { id: string; nome: string; colore: string };
}

export function toChatDto(m: ChatMessageRow): ChatMessageDto {
  return { id: m.id, clientId: m.clientId, testo: m.testo, createdAt: m.createdAt.toISOString(), author: m.author };
}

export interface StaffUserDto {
  id: string;
  nome: string;
  colore: string;
}

export async function listStaffUsers(): Promise<StaffUserDto[]> {
  return prisma.user.findMany({
    where: { attivo: true, ruolo: { in: RUOLI_STAFF } },
    select: { id: true, nome: true, colore: true },
    orderBy: { nome: "asc" },
  });
}

export async function getChatMessages(clientId: string, opts: { after?: Date; limit?: number } = {}) {
  if (opts.after) {
    return prisma.chatMessage.findMany({
      where: { clientId, createdAt: { gt: opts.after } },
      select: chatMessageSelect,
      orderBy: { createdAt: "asc" },
      take: 500,
    });
  }
  // Ultimi N messaggi in ordine cronologico
  const rows = await prisma.chatMessage.findMany({
    where: { clientId },
    select: chatMessageSelect,
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? CHAT_INITIAL_LIMIT,
  });
  return rows.reverse();
}

export async function markChatRead(userId: string, clientId: string) {
  const now = new Date();
  await prisma.chatRead.upsert({
    where: { userId_clientId: { userId, clientId } },
    create: { userId, clientId, lastReadAt: now },
    update: { lastReadAt: now },
  });
}

/** Trova gli utenti staff menzionati con "@Nome Cognome" nel testo (case-insensitive). */
export function findMentionedUsers<T extends { id: string; nome: string }>(testo: string, staff: T[]): T[] {
  const lower = testo.toLowerCase();
  return staff.filter((u) => u.nome.trim() && lower.includes(`@${u.nome.trim().toLowerCase()}`));
}

/**
 * Crea un messaggio in chat e invia le notifiche: al referente del cliente (se non è l'autore)
 * e a ogni utente staff menzionato.
 */
export async function createChatMessage(opts: { clientId: string; author: { id: string; nome: string }; testo: string }) {
  const client = await prisma.client.findUnique({ where: { id: opts.clientId }, select: { id: true, denominazione: true, referenteId: true } });
  if (!client) throw new Error("Cliente non trovato.");

  const message = await prisma.chatMessage.create({
    data: { clientId: client.id, authorId: opts.author.id, testo: opts.testo },
    select: chatMessageSelect,
  });
  await markChatRead(opts.author.id, client.id);

  const staff = await listStaffUsers();
  const mentioned = findMentionedUsers(opts.testo, staff)
    .map((u) => u.id)
    .filter((id) => id !== opts.author.id);
  const link = `/chat/${client.id}`;
  const corpo = truncate(opts.testo.replace(/\s+/g, " "), 140);

  const tasks: Promise<unknown>[] = [];
  if (mentioned.length) {
    tasks.push(
      notifyMany(mentioned, {
        tipo: "CHAT_MENZIONE",
        titolo: `${opts.author.nome} ti ha menzionato · ${client.denominazione}`,
        corpo,
        link,
      }),
    );
  }
  if (client.referenteId && client.referenteId !== opts.author.id && !mentioned.includes(client.referenteId)) {
    tasks.push(
      notify({
        userId: client.referenteId,
        tipo: "CHAT_MESSAGGIO",
        titolo: `Nuovo messaggio · ${client.denominazione}`,
        corpo: `${opts.author.nome}: ${corpo}`,
        link,
      }),
    );
  }
  await Promise.allSettled(tasks);
  return message;
}

export interface ConversationItem {
  id: string;
  denominazione: string;
  attivo: boolean;
  lastMessage: { testo: string; createdAt: Date; authorNome: string; authorId: string } | null;
  unread: number;
}

/** Elenco clienti con anteprima dell'ultimo messaggio e conteggio non letti per l'utente. */
export async function listConversations(userId: string): Promise<ConversationItem[]> {
  const [clients, lastMessages, reads] = await Promise.all([
    prisma.client.findMany({ select: { id: true, denominazione: true, attivo: true }, orderBy: { denominazione: "asc" } }),
    prisma.chatMessage.findMany({
      distinct: ["clientId"],
      orderBy: { createdAt: "desc" },
      select: { clientId: true, testo: true, createdAt: true, authorId: true, author: { select: { nome: true } } },
    }),
    prisma.chatRead.findMany({ where: { userId }, select: { clientId: true, lastReadAt: true } }),
  ]);

  const withLast = new Set(lastMessages.map((m) => m.clientId));
  const unreadWhere: Prisma.ChatMessageWhereInput = {
    authorId: { not: userId },
    OR: [
      ...reads.map((r) => ({ clientId: r.clientId, createdAt: { gt: r.lastReadAt } })),
      { clientId: { notIn: reads.map((r) => r.clientId) } },
    ],
  };
  const unreadGroups = withLast.size
    ? await prisma.chatMessage.groupBy({ by: ["clientId"], where: unreadWhere, _count: { _all: true } })
    : [];
  const unreadMap = new Map(unreadGroups.map((g) => [g.clientId, g._count._all]));

  const lastMap = new Map(lastMessages.map((m) => [m.clientId, m]));
  const items: ConversationItem[] = clients.map((c) => {
    const last = lastMap.get(c.id);
    return {
      id: c.id,
      denominazione: c.denominazione,
      attivo: c.attivo,
      lastMessage: last ? { testo: last.testo, createdAt: last.createdAt, authorNome: last.author.nome, authorId: last.authorId } : null,
      unread: unreadMap.get(c.id) ?? 0,
    };
  });
  items.sort((a, b) => {
    if (a.lastMessage && b.lastMessage) return b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime();
    if (a.lastMessage) return -1;
    if (b.lastMessage) return 1;
    return a.denominazione.localeCompare(b.denominazione, "it");
  });
  return items;
}
