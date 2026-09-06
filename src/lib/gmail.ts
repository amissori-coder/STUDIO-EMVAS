import "server-only";
import { prisma } from "@/lib/db";
import { refreshAccessToken } from "@/lib/auth/google";
import { notify } from "@/lib/notifications";
import { normalizeEmail, truncate } from "@/lib/utils";
import type { GoogleAccount } from "@prisma/client";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Restituisce un access token valido, rinnovandolo se necessario. */
export async function getValidAccessToken(account: GoogleAccount): Promise<string> {
  const expiresSoon = account.expiresAt.getTime() - Date.now() < 60_000;
  if (!expiresSoon) return account.accessToken;
  if (!account.refreshToken) {
    throw new GmailError("Token Google scaduto e nessun refresh token: ricollega l'account Gmail.", 401);
  }
  const tokens = await refreshAccessToken(account.refreshToken);
  const updated = await prisma.googleAccount.update({
    where: { id: account.id },
    data: {
      accessToken: tokens.access_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
    },
  });
  account.accessToken = updated.accessToken;
  account.expiresAt = updated.expiresAt;
  return updated.accessToken;
}

async function gmailFetch<T>(account: GoogleAccount, path: string, init?: RequestInit): Promise<T> {
  const token = await getValidAccessToken(account);
  const res = await fetch(`${GMAIL_API}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new GmailError(`Gmail API ${res.status}: ${truncate(text, 300)}`, res.status);
  }
  return (await res.json()) as T;
}

// ---- Tipi minimi della Gmail API ----
interface GmailHeader { name: string; value: string }
interface GmailPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailPart[];
}
interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  payload?: GmailPart;
}
interface GmailListResponse { messages?: { id: string; threadId: string }[]; nextPageToken?: string; resultSizeEstimate?: number }
interface GmailHistoryResponse {
  history?: { id: string; messagesAdded?: { message: { id: string; threadId: string } }[] }[];
  nextPageToken?: string;
  historyId?: string;
}
interface GmailProfile { emailAddress: string; historyId: string; messagesTotal?: number }

export interface ParsedAttachment { filename: string; mimeType: string; size: number; attachmentId: string }

function decodeBase64Url(data: string) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function header(headers: GmailHeader[] | undefined, name: string) {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/** "Mario Rossi <mario@x.it>" -> { name: "Mario Rossi", email: "mario@x.it" } */
export function parseAddress(raw: string): { name: string | null; email: string } {
  const m = /^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/.exec(raw);
  if (m) return { name: m[1].trim() || null, email: normalizeEmail(m[2]) };
  return { name: null, email: normalizeEmail(raw) };
}

export function parseAddressList(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => parseAddress(s).email)
    .filter(Boolean);
}

function walkParts(part: GmailPart | undefined, acc: { text: string[]; html: string[]; attachments: ParsedAttachment[] }) {
  if (!part) return;
  const mime = part.mimeType ?? "";
  if (part.filename && part.body?.attachmentId) {
    acc.attachments.push({
      filename: part.filename,
      mimeType: mime || "application/octet-stream",
      size: part.body.size ?? 0,
      attachmentId: part.body.attachmentId,
    });
  } else if (mime === "text/plain" && part.body?.data) {
    acc.text.push(decodeBase64Url(part.body.data).toString("utf8"));
  } else if (mime === "text/html" && part.body?.data) {
    acc.html.push(decodeBase64Url(part.body.data).toString("utf8"));
  }
  part.parts?.forEach((p) => walkParts(p, acc));
}

/** Rimuove script/style e tag pericolosi da un HTML di email prima di mostrarlo. */
export function sanitizeEmailHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<(iframe|object|embed|form|meta|link)[\s\S]*?>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface ParsedEmail {
  gmailId: string;
  threadId: string;
  fromAddr: string;
  fromName: string | null;
  toAddrs: string[];
  ccAddrs: string[];
  subject: string;
  snippet: string;
  bodyText: string;
  bodyHtml: string | null;
  receivedAt: Date;
  attachments: ParsedAttachment[];
  labelIds: string[];
  isUnread: boolean;
}

export function parseGmailMessage(msg: GmailMessage): ParsedEmail {
  const headers = msg.payload?.headers;
  const from = parseAddress(header(headers, "From"));
  const acc = { text: [] as string[], html: [] as string[], attachments: [] as ParsedAttachment[] };
  walkParts(msg.payload, acc);
  const bodyHtml = acc.html.length ? sanitizeEmailHtml(acc.html.join("\n")) : null;
  const bodyText = acc.text.length ? acc.text.join("\n") : bodyHtml ? htmlToText(bodyHtml) : msg.snippet ?? "";
  const dateHeader = header(headers, "Date");
  const receivedAt = msg.internalDate ? new Date(Number(msg.internalDate)) : dateHeader ? new Date(dateHeader) : new Date();
  return {
    gmailId: msg.id,
    threadId: msg.threadId,
    fromAddr: from.email,
    fromName: from.name,
    toAddrs: parseAddressList(header(headers, "To")),
    ccAddrs: parseAddressList(header(headers, "Cc")),
    subject: header(headers, "Subject") || "(senza oggetto)",
    snippet: msg.snippet ?? "",
    bodyText: bodyText.slice(0, 200_000),
    bodyHtml: bodyHtml ? bodyHtml.slice(0, 500_000) : null,
    receivedAt: isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
    attachments: acc.attachments,
    labelIds: msg.labelIds ?? [],
    isUnread: (msg.labelIds ?? []).includes("UNREAD"),
  };
}

/**
 * Trova il cliente associato a un insieme di indirizzi email (email/PEC del cliente o dei suoi contatti).
 */
export async function findClientByEmails(addresses: string[]): Promise<string | null> {
  const list = Array.from(new Set(addresses.map(normalizeEmail).filter(Boolean)));
  if (!list.length) return null;
  const client = await prisma.client.findFirst({
    where: { attivo: true, OR: [{ email: { in: list } }, { pec: { in: list } }] },
    select: { id: true },
  });
  if (client) return client.id;
  const contact = await prisma.clientContact.findFirst({ where: { email: { in: list } }, select: { clientId: true } });
  return contact?.clientId ?? null;
}

async function listMessageIds(account: GoogleAccount, query: string, max: number): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < max) {
    const params = new URLSearchParams({ q: query, maxResults: String(Math.min(100, max - ids.length)) });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await gmailFetch<GmailListResponse>(account, `/messages?${params}`);
    for (const m of res.messages ?? []) ids.push(m.id);
    if (!res.nextPageToken || !(res.messages?.length)) break;
    pageToken = res.nextPageToken;
  }
  return ids;
}

async function listHistoryMessageIds(account: GoogleAccount, startHistoryId: string): Promise<{ ids: string[]; historyId: string | null }> {
  const ids = new Set<string>();
  let pageToken: string | undefined;
  let latest: string | null = null;
  for (let i = 0; i < 20; i++) {
    const params = new URLSearchParams({ startHistoryId, historyTypes: "messageAdded", maxResults: "500" });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await gmailFetch<GmailHistoryResponse>(account, `/history?${params}`);
    latest = res.historyId ?? latest;
    for (const h of res.history ?? []) for (const a of h.messagesAdded ?? []) ids.add(a.message.id);
    if (!res.nextPageToken) break;
    pageToken = res.nextPageToken;
  }
  return { ids: Array.from(ids), historyId: latest };
}

export interface SyncResult { imported: number; linked: number; skipped: number; error?: string }

/**
 * Sincronizza la casella Gmail di un account: importa i nuovi messaggi, li collega
 * automaticamente ai clienti e notifica il referente del cliente.
 */
export async function syncGoogleAccount(accountId: string): Promise<SyncResult> {
  const account = await prisma.googleAccount.findUnique({ where: { id: accountId }, include: { user: true } });
  if (!account) return { imported: 0, linked: 0, skipped: 0, error: "Account non trovato" };

  const max = Number(process.env.GMAIL_SYNC_MAX ?? 300) || 300;
  const days = Number(process.env.GMAIL_SYNC_DAYS ?? 30) || 30;
  const result: SyncResult = { imported: 0, linked: 0, skipped: 0 };

  try {
    let ids: string[] = [];
    let newHistoryId: string | null = null;

    if (account.historyId) {
      try {
        const h = await listHistoryMessageIds(account, account.historyId);
        ids = h.ids;
        newHistoryId = h.historyId;
      } catch (e) {
        // historyId troppo vecchio (404): ricadiamo sulla ricerca degli ultimi giorni
        if ((e as GmailError).status !== 404) throw e;
        ids = await listMessageIds(account, `newer_than:7d -in:spam -in:trash`, max);
      }
    } else {
      ids = await listMessageIds(account, `newer_than:${days}d -in:spam -in:trash`, max);
    }

    if (ids.length) {
      const existing = await prisma.emailMessage.findMany({
        where: { accountId, gmailId: { in: ids } },
        select: { gmailId: true },
      });
      const known = new Set(existing.map((e) => e.gmailId));
      const toFetch = ids.filter((id) => !known.has(id)).slice(0, max);
      result.skipped = ids.length - toFetch.length;

      for (const id of toFetch) {
        let msg: GmailMessage;
        try {
          msg = await gmailFetch<GmailMessage>(account, `/messages/${id}?format=full`);
        } catch (e) {
          if ((e as GmailError).status === 404) continue; // eliminato nel frattempo
          throw e;
        }
        if ((msg.labelIds ?? []).some((l) => l === "SPAM" || l === "TRASH" || l === "DRAFT")) continue;
        const parsed = parseGmailMessage(msg);
        const clientId = await findClientByEmails([parsed.fromAddr, ...parsed.toAddrs, ...parsed.ccAddrs]);
        const created = await prisma.emailMessage.upsert({
          where: { accountId_gmailId: { accountId, gmailId: parsed.gmailId } },
          create: {
            accountId,
            gmailId: parsed.gmailId,
            threadId: parsed.threadId,
            fromAddr: parsed.fromAddr,
            fromName: parsed.fromName,
            toAddrs: parsed.toAddrs.join(", "),
            ccAddrs: parsed.ccAddrs.join(", ") || null,
            subject: parsed.subject,
            snippet: parsed.snippet,
            bodyText: parsed.bodyText,
            bodyHtml: parsed.bodyHtml,
            receivedAt: parsed.receivedAt,
            hasAttachments: parsed.attachments.length > 0,
            attachments: parsed.attachments.length ? JSON.stringify(parsed.attachments) : null,
            labelIds: parsed.labelIds.join(","),
            isUnread: parsed.isUnread,
            clientId,
            linkAuto: !!clientId,
            linkedAt: clientId ? new Date() : null,
          },
          update: {},
        });
        result.imported++;
        if (clientId) {
          result.linked++;
          const client = await prisma.client.findUnique({ where: { id: clientId }, select: { denominazione: true, referenteId: true } });
          const isIncoming = parsed.fromAddr !== normalizeEmail(account.googleEmail);
          if (client?.referenteId && isIncoming) {
            await notify({
              userId: client.referenteId,
              tipo: "EMAIL_CLIENTE",
              titolo: `Email da ${client.denominazione}`,
              corpo: truncate(parsed.subject, 120),
              link: `/email/${created.id}`,
            });
          }
        }
      }
    }

    if (!newHistoryId) {
      const profile = await gmailFetch<GmailProfile>(account, "/profile");
      newHistoryId = profile.historyId;
    }
    await prisma.googleAccount.update({
      where: { id: accountId },
      data: { historyId: newHistoryId, lastSyncAt: new Date(), syncError: null },
    });
  } catch (e) {
    const message = (e as Error).message ?? String(e);
    console.error(`[gmail] sync fallita per ${account.googleEmail}:`, message);
    await prisma.googleAccount.update({ where: { id: accountId }, data: { syncError: truncate(message, 500), lastSyncAt: new Date() } });
    result.error = message;
  }
  return result;
}

/** Sincronizza tutti gli account Gmail collegati. */
export async function syncAllGoogleAccounts() {
  const accounts = await prisma.googleAccount.findMany({ select: { id: true } });
  const results: Record<string, SyncResult> = {};
  for (const a of accounts) results[a.id] = await syncGoogleAccount(a.id);
  return results;
}

/** Scarica un allegato (bytes) da Gmail. */
export async function fetchGmailAttachment(accountId: string, gmailMessageId: string, attachmentId: string): Promise<Buffer> {
  const account = await prisma.googleAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new GmailError("Account Gmail non trovato", 404);
  const res = await gmailFetch<{ data?: string; size?: number }>(account, `/messages/${gmailMessageId}/attachments/${attachmentId}`);
  if (!res.data) throw new GmailError("Allegato vuoto", 404);
  return decodeBase64Url(res.data);
}

export function gmailWebUrl(googleEmail: string, gmailId: string) {
  return `https://mail.google.com/mail/u/${encodeURIComponent(googleEmail)}/#all/${gmailId}`;
}
