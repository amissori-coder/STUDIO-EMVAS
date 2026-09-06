import "server-only";
import { prisma } from "@/lib/db";
import { refreshAccessToken } from "@/lib/auth/google";
import { notify } from "@/lib/notifications";
import { RUOLI_STAFF } from "@/lib/constants";
import { normalizeEmail, truncate } from "@/lib/utils";
import {
  decodeBase64Url,
  parseGmailMessage,
  type GmailHistoryResponse,
  type GmailListResponse,
  type GmailMessage,
  type GmailProfile,
} from "@/lib/gmail-parse";

export * from "@/lib/gmail-parse";
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

/**
 * Trova il cliente (attivo) associato a un insieme di indirizzi email (email/PEC del cliente o dei suoi contatti).
 */
export async function findClientByEmails(addresses: string[]): Promise<string | null> {
  const list = Array.from(new Set(addresses.map(normalizeEmail).filter(Boolean)));
  if (!list.length) return null;
  const client = await prisma.client.findFirst({
    where: { attivo: true, OR: [{ email: { in: list } }, { pec: { in: list } }] },
    select: { id: true },
  });
  if (client) return client.id;
  const contact = await prisma.clientContact.findFirst({
    where: { email: { in: list }, client: { attivo: true } },
    select: { clientId: true },
  });
  return contact?.clientId ?? null;
}

/** Indirizzi dello studio (utenti staff e caselle collegate): non partecipano all'associazione ai clienti. */
async function loadStudioAddresses(): Promise<Set<string>> {
  const [users, accounts] = await Promise.all([
    prisma.user.findMany({ where: { ruolo: { in: [...RUOLI_STAFF] } }, select: { email: true } }),
    prisma.googleAccount.findMany({ select: { googleEmail: true } }),
  ]);
  return new Set([...users.map((u) => normalizeEmail(u.email)), ...accounts.map((a) => normalizeEmail(a.googleEmail))]);
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
 *
 * Notifiche: solo nelle sincronizzazioni incrementali (mai al primo collegamento della casella,
 * che importerebbe settimane di posta già letta) e solo per messaggi in entrata il cui mittente
 * è un indirizzo del cliente (non per email scritte dallo studio con il cliente in copia).
 */
export async function syncGoogleAccount(accountId: string): Promise<SyncResult> {
  const account = await prisma.googleAccount.findUnique({ where: { id: accountId }, include: { user: true } });
  if (!account) return { imported: 0, linked: 0, skipped: 0, error: "Account non trovato" };

  const max = Number(process.env.GMAIL_SYNC_MAX ?? 300) || 300;
  const days = Number(process.env.GMAIL_SYNC_DAYS ?? 30) || 30;
  const result: SyncResult = { imported: 0, linked: 0, skipped: 0 };
  const incremental = !!account.historyId;
  const previousSyncAt = account.lastSyncAt;

  try {
    let ids: string[] = [];
    let newHistoryId: string | null = null;
    let fallback = false;

    if (account.historyId) {
      try {
        const h = await listHistoryMessageIds(account, account.historyId);
        ids = h.ids;
        newHistoryId = h.historyId;
      } catch (e) {
        // historyId troppo vecchio (404): ricadiamo sulla ricerca dei giorni trascorsi dall'ultimo sync
        if ((e as GmailError).status !== 404) throw e;
        fallback = true;
        const trascorsi = previousSyncAt ? Math.ceil((Date.now() - previousSyncAt.getTime()) / 86_400_000) + 1 : days;
        ids = await listMessageIds(account, `newer_than:${Math.max(7, trascorsi)}d -in:spam -in:trash`, max);
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
      const nuovi = ids.filter((id) => !known.has(id));
      const toFetch = nuovi.slice(0, max);
      result.skipped = ids.length - toFetch.length;
      // Se nel ramo incrementale restano messaggi oltre il limite, NON avanziamo l'historyId:
      // verranno ripresi (già noti esclusi) alla prossima sincronizzazione.
      if (nuovi.length > toFetch.length && newHistoryId) newHistoryId = account.historyId;

      const studioAddresses = await loadStudioAddresses();
      const selfAddr = normalizeEmail(account.googleEmail);

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

        // Associazione: prima il mittente, poi i destinatari (esclusi gli indirizzi dello studio)
        const fromIsStudio = studioAddresses.has(parsed.fromAddr) || parsed.fromAddr === selfAddr;
        const isSent = parsed.labelIds.includes("SENT") || fromIsStudio;
        let clientId = !fromIsStudio && parsed.fromAddr ? await findClientByEmails([parsed.fromAddr]) : null;
        const senderIsClient = !!clientId;
        if (!clientId) {
          const recipients = [...parsed.toAddrs, ...parsed.ccAddrs].filter((a) => a !== selfAddr && !studioAddresses.has(a));
          clientId = recipients.length ? await findClientByEmails(recipients) : null;
        }

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
          const isNew = incremental && (!fallback || !previousSyncAt || parsed.receivedAt > previousSyncAt);
          if (isNew && senderIsClient && !isSent) {
            const client = await prisma.client.findUnique({ where: { id: clientId }, select: { denominazione: true, referenteId: true } });
            if (client?.referenteId) {
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

export interface AttachmentHint { partId?: string; filename?: string; size?: number }

/**
 * Scarica un allegato (bytes) da Gmail. Gli attachmentId non sono stabili nel tempo: se Gmail risponde 404,
 * il messaggio viene riletto e l'allegato ritrovato tramite `hint` (partId, oppure filename+size) o,
 * se il messaggio ha un solo allegato, preso direttamente.
 */
export async function fetchGmailAttachment(accountId: string, gmailMessageId: string, attachmentId: string, hint?: AttachmentHint): Promise<Buffer> {
  const account = await prisma.googleAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new GmailError("Account Gmail non trovato", 404);
  const download = async (id: string) => {
    const res = await gmailFetch<{ data?: string; size?: number }>(account, `/messages/${gmailMessageId}/attachments/${id}`);
    if (!res.data) throw new GmailError("Allegato vuoto", 404);
    return decodeBase64Url(res.data);
  };
  try {
    return await download(attachmentId);
  } catch (e) {
    if ((e as GmailError).status !== 404) throw e;
    const msg = await gmailFetch<GmailMessage>(account, `/messages/${gmailMessageId}?format=full`);
    const atts = parseGmailMessage(msg).attachments;
    const fresh =
      (hint?.partId && atts.find((a) => a.partId === hint.partId)) ||
      (hint?.filename && atts.find((a) => a.filename === hint.filename && (hint.size === undefined || a.size === hint.size))) ||
      (atts.length === 1 ? atts[0] : undefined);
    if (!fresh || fresh.attachmentId === attachmentId) {
      throw new GmailError("Allegato non più disponibile su Gmail: aprilo da Gmail e ricaricalo manualmente.", 404);
    }
    return download(fresh.attachmentId);
  }
}

export function gmailWebUrl(googleEmail: string, gmailId: string) {
  return `https://mail.google.com/mail/u/${encodeURIComponent(googleEmail)}/#all/${gmailId}`;
}
