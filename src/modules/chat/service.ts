import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { notify, notifyMany } from "@/lib/notifications";
import { RUOLI_STAFF } from "@/lib/constants";
import { truncate } from "@/lib/utils";
import { buildMessageRegex } from "./text";

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

/**
 * Messaggi di una conversazione in ordine cronologico.
 * - `after`: solo i messaggi successivi (polling);
 * - `before`: gli ultimi `limit` messaggi precedenti a quella data (caricamento dello storico);
 * - altrimenti gli ultimi `limit` messaggi.
 */
export async function getChatMessages(clientId: string, opts: { after?: Date; before?: Date; limit?: number } = {}) {
  if (opts.after) {
    return prisma.chatMessage.findMany({
      where: { clientId, createdAt: { gt: opts.after } },
      select: chatMessageSelect,
      orderBy: { createdAt: "asc" },
      take: 500,
    });
  }
  // Ultimi N messaggi (eventualmente prima di `before`) in ordine cronologico
  const rows = await prisma.chatMessage.findMany({
    where: { clientId, ...(opts.before ? { createdAt: { lt: opts.before } } : {}) },
    select: chatMessageSelect,
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? CHAT_INITIAL_LIMIT,
  });
  return rows.reverse();
}

/** True se esistono messaggi precedenti a `before` (per mostrare "Carica messaggi precedenti"). */
export async function hasOlderChatMessages(clientId: string, before: Date | undefined) {
  if (!before) return false;
  const older = await prisma.chatMessage.findFirst({ where: { clientId, createdAt: { lt: before } }, select: { id: true } });
  return !!older;
}

/** Numero di messaggi con data >= `from`: il client lo confronta con quelli caricati per rilevare le eliminazioni. */
export async function countChatMessagesSince(clientId: string, from: Date) {
  return prisma.chatMessage.count({ where: { clientId, createdAt: { gte: from } } });
}

export async function markChatRead(userId: string, clientId: string) {
  const now = new Date();
  await prisma.chatRead.upsert({
    where: { userId_clientId: { userId, clientId } },
    create: { userId, clientId, lastReadAt: now },
    update: { lastReadAt: now },
  });
}

/**
 * Trova gli utenti staff menzionati con "@Nome Cognome" nel testo (case-insensitive).
 * Usa la stessa espressione regolare dell'evidenziazione (text.tsx): il nome più lungo ha la precedenza
 * e dopo il nome non può seguire una lettera o una cifra, così "@Anna Maria Rossi" o "@Annalisa"
 * non menzionano anche "Anna".
 */
export function findMentionedUsers<T extends { id: string; nome: string }>(testo: string, staff: T[]): T[] {
  const byName = new Map<string, T[]>();
  for (const u of staff) {
    const key = u.nome.trim().toLowerCase();
    if (!key) continue;
    byName.set(key, [...(byName.get(key) ?? []), u]);
  }
  if (!byName.size || !testo.includes("@")) return [];
  const regex = buildMessageRegex(staff.map((u) => u.nome));
  const found = new Set<T>();
  for (const m of testo.matchAll(regex)) {
    const mention = m[2];
    if (!mention) continue;
    for (const u of byName.get(mention.slice(1).trim().toLowerCase()) ?? []) found.add(u);
  }
  return staff.filter((u) => found.has(u));
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
  const [clients, lastPerClient, reads] = await Promise.all([
    prisma.client.findMany({ select: { id: true, denominazione: true, attivo: true }, orderBy: { denominazione: "asc" } }),
    // Data dell'ultimo messaggio per cliente, aggregata nel DB: `distinct` di Prisma leggerebbe l'intera tabella in memoria
    prisma.chatMessage.groupBy({ by: ["clientId"], _max: { createdAt: true } }),
    prisma.chatRead.findMany({ where: { userId }, select: { clientId: true, lastReadAt: true } }),
  ]);
  const lastKeys = lastPerClient.flatMap((g) => (g._max.createdAt ? [{ clientId: g.clientId, createdAt: g._max.createdAt }] : []));
  const lastMessages = lastKeys.length
    ? await prisma.chatMessage.findMany({
        where: { OR: lastKeys },
        orderBy: { createdAt: "desc" },
        select: { clientId: true, testo: true, createdAt: true, authorId: true, author: { select: { nome: true } } },
      })
    : [];

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

  // Se due messaggi hanno lo stesso istante, tengo il primo (l'elenco è già in ordine decrescente)
  const lastMap = new Map<string, (typeof lastMessages)[number]>();
  for (const m of lastMessages) if (!lastMap.has(m.clientId)) lastMap.set(m.clientId, m);
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
