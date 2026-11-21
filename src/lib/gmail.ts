import "server-only";
import { prisma } from "@/lib/db";
import { refreshAccessToken } from "@/lib/auth/google";
import { notify, notifyAdmins } from "@/lib/notifications";
import { conLucchetto } from "@/lib/cron/registro";
import type { OrigineJob } from "@/lib/cron/stato";
import { clienteUnivoco, giorniDaRecuperare, LIMITE_ELENCO, pianoImportazione } from "@/lib/gmail-regole";
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
 * Clienti (attivi) a cui corrisponde un insieme di indirizzi: email e PEC del cliente o dei suoi contatti.
 * Ne restituisce al più qualcuno: basta sapere se è uno solo.
 */
export async function clientiPerIndirizzi(addresses: string[]): Promise<string[]> {
  const list = Array.from(new Set(addresses.map(normalizeEmail).filter(Boolean)));
  if (!list.length) return [];
  const [clienti, contatti] = await Promise.all([
    prisma.client.findMany({ where: { attivo: true, OR: [{ email: { in: list } }, { pec: { in: list } }] }, select: { id: true }, take: 3 }),
    prisma.clientContact.findMany({ where: { email: { in: list }, client: { attivo: true } }, select: { clientId: true }, distinct: ["clientId"], take: 3 }),
  ]);
  return [...new Set([...clienti.map((c) => c.id), ...contatti.map((c) => c.clientId)])];
}

/** Il cliente degli indirizzi, solo se è uno e uno solo (vedi clienteUnivoco). */
export async function findClientByEmails(addresses: string[]): Promise<string | null> {
  return clienteUnivoco(await clientiPerIndirizzi(addresses));
}

/** Indirizzi dello studio (utenti staff e caselle collegate): non partecipano all'associazione ai clienti. */
export async function loadStudioAddresses(): Promise<Set<string>> {
  const [users, accounts] = await Promise.all([
    prisma.user.findMany({ where: { ruolo: { in: [...RUOLI_STAFF] } }, select: { email: true } }),
    prisma.googleAccount.findMany({ select: { googleEmail: true } }),
  ]);
  return new Set([...users.map((u) => normalizeEmail(u.email)), ...accounts.map((a) => normalizeEmail(a.googleEmail))]);
}

async function listMessageIds(account: GoogleAccount, query: string, max: number): Promise<{ ids: string[]; completo: boolean }> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < max) {
    const params = new URLSearchParams({ q: query, maxResults: String(Math.min(100, max - ids.length)) });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await gmailFetch<GmailListResponse>(account, `/messages?${params}`);
    for (const m of res.messages ?? []) ids.push(m.id);
    if (!res.nextPageToken || !(res.messages?.length)) return { ids, completo: true };
    pageToken = res.nextPageToken;
  }
  return { ids, completo: false };
}

/** Messaggi aggiunti dopo `startHistoryId`. `completo` è falso se la storia è più lunga di quanto letto. */
async function listHistoryMessageIds(account: GoogleAccount, startHistoryId: string): Promise<{ ids: string[]; historyId: string | null; completo: boolean }> {
  const ids = new Set<string>();
  let pageToken: string | undefined;
  let latest: string | null = null;
  for (let i = 0; i < 20; i++) {
    const params = new URLSearchParams({ startHistoryId, historyTypes: "messageAdded", maxResults: "500" });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await gmailFetch<GmailHistoryResponse>(account, `/history?${params}`);
    latest = res.historyId ?? latest;
    for (const h of res.history ?? []) for (const a of h.messagesAdded ?? []) ids.add(a.message.id);
    if (!res.nextPageToken) return { ids: Array.from(ids), historyId: latest, completo: true };
    pageToken = res.nextPageToken;
  }
  return { ids: Array.from(ids), historyId: latest, completo: false };
}

export interface SyncResult {
  imported: number;
  linked: number;
  /** messaggi esclusi (spam, cestino, bozze, eliminati nel frattempo) */
  skipped: number;
  /** messaggi nuovi lasciati alla prossima sincronizzazione per il limite GMAIL_SYNC_MAX */
  restanti: number;
  /** la stessa casella era già in sincronizzazione: questa esecuzione non ha fatto nulla */
  giaInCorso?: boolean;
  error?: string;
}

/**
 * Sincronizza la casella Gmail di un account: importa i nuovi messaggi, li collega
 * automaticamente ai clienti e notifica il referente del cliente.
 *
 * Notifiche: solo nelle sincronizzazioni successive alla prima (mai al primo collegamento della casella,
 * che importerebbe settimane di posta già letta) e solo per messaggi in entrata il cui mittente
 * è un indirizzo del cliente (non per email scritte dallo studio con il cliente in copia).
 *
 * Una casella alla volta: se è già in sincronizzazione (pianificatore e pulsante insieme) si rinuncia.
 * `lastSyncAt` è l'ora dell'ultima sincronizzazione COMPLETA: con messaggi ancora da importare, o in
 * caso di errore, non avanza (né avanza il punto di ripresa), così nulla resta indietro.
 */
export async function syncGoogleAccount(accountId: string, origine: OrigineJob = "MANUALE"): Promise<SyncResult> {
  const r = await conLucchetto(`casella:${accountId}`, origine, () => sincronizzaCasella(accountId));
  return r.preso ? r.risultato : { imported: 0, linked: 0, skipped: 0, restanti: 0, giaInCorso: true };
}

async function sincronizzaCasella(accountId: string): Promise<SyncResult> {
  const account = await prisma.googleAccount.findUnique({ where: { id: accountId }, include: { user: true } });
  if (!account) return { imported: 0, linked: 0, skipped: 0, restanti: 0, error: "Account non trovato" };

  const max = Number(process.env.GMAIL_SYNC_MAX ?? 300) || 300;
  const days = Number(process.env.GMAIL_SYNC_DAYS ?? 30) || 30;
  const result: SyncResult = { imported: 0, linked: 0, skipped: 0, restanti: 0 };
  // la prima importazione (casella appena collegata) non notifica: è posta già vista
  const notificabile = !!account.historyId;
  const ultimaCompleta = account.lastSyncAt;

  try {
    let ids: string[] = [];
    let puntoDiRipresa: string | null = null;

    let storia: Awaited<ReturnType<typeof listHistoryMessageIds>> | null = null;
    if (account.historyId) {
      try {
        storia = await listHistoryMessageIds(account, account.historyId);
      } catch (e) {
        // storia troppo vecchia (404): si ricade sulla ricerca per data
        if ((e as GmailError).status !== 404) throw e;
      }
    }
    const ricercaPerData = !storia || !storia.completo; // anche una storia troppo lunga si legge per data
    if (storia && storia.completo) {
      ids = storia.ids;
      puntoDiRipresa = storia.historyId ?? account.historyId;
    } else {
      // il punto di ripresa si legge PRIMA di elencare: quel che arriva durante l'importazione verrà
      // preso dalla storia alla volta successiva (leggerlo dopo, come prima, poteva saltarlo)
      puntoDiRipresa = (await gmailFetch<GmailProfile>(account, "/profile")).historyId;
      const giorni = account.historyId ? giorniDaRecuperare(ultimaCompleta, new Date(), days) : days;
      ids = (await listMessageIds(account, `newer_than:${giorni}d -in:spam -in:trash`, LIMITE_ELENCO)).ids;
    }

    const existing = ids.length ? await prisma.emailMessage.findMany({ where: { accountId, gmailId: { in: ids } }, select: { gmailId: true } }) : [];
    const piano = pianoImportazione(ids, new Set(existing.map((e) => e.gmailId)), max);
    result.restanti = piano.restanti;

    if (piano.daScaricare.length) {
      const studioAddresses = await loadStudioAddresses();
      const selfAddr = normalizeEmail(account.googleEmail);

      for (const id of piano.daScaricare) {
        let msg: GmailMessage;
        try {
          msg = await gmailFetch<GmailMessage>(account, `/messages/${id}?format=full`);
        } catch (e) {
          if ((e as GmailError).status === 404) {
            result.skipped++;
            continue; // eliminato nel frattempo
          }
          throw e;
        }
        if ((msg.labelIds ?? []).some((l) => l === "SPAM" || l === "TRASH" || l === "DRAFT")) {
          result.skipped++;
          continue;
        }
        const parsed = parseGmailMessage(msg);

        // Associazione: prima il mittente, poi i destinatari (esclusi gli indirizzi dello studio), e solo
        // se portano a un unico cliente
        const fromIsStudio = studioAddresses.has(parsed.fromAddr) || parsed.fromAddr === selfAddr;
        const isSent = parsed.labelIds.includes("SENT") || fromIsStudio;
        const clientiMittente = !fromIsStudio && parsed.fromAddr ? await clientiPerIndirizzi([parsed.fromAddr]) : [];
        let clientId = clienteUnivoco(clientiMittente);
        const senderIsClient = !!clientId;
        // un mittente condiviso fra più clienti resta da associare a mano: i destinatari non decidono al suo posto
        if (!clientId && clientiMittente.length === 0) {
          const recipients = [...parsed.toAddrs, ...parsed.ccAddrs].filter((a) => a !== selfAddr && !studioAddresses.has(a));
          clientId = recipients.length ? await findClientByEmails(recipients) : null;
        }

        let created: { id: string };
        try {
          created = await prisma.emailMessage.create({
            data: {
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
            select: { id: true },
          });
        } catch (e) {
          // già importato (doppione nell'elenco): niente seconda notifica
          if ((e as { code?: string }).code === "P2002") continue;
          throw e;
        }
        result.imported++;
        if (clientId) {
          result.linked++;
          const isNew = notificabile && (!ricercaPerData || !ultimaCompleta || parsed.receivedAt > ultimaCompleta);
          if (isNew && senderIsClient && !isSent) await avvisaEmailCliente(clientId, created.id, parsed.subject);
        }
      }
    }

    await prisma.googleAccount.update({
      where: { id: accountId },
      data: piano.avanza ? { historyId: puntoDiRipresa, lastSyncAt: new Date(), syncError: null } : { syncError: null },
    });
  } catch (e) {
    const message = (e as Error).message ?? String(e);
    console.error(`[gmail] sync fallita per ${account.googleEmail}:`, message);
    await prisma.googleAccount.update({ where: { id: accountId }, data: { syncError: truncate(message, 500) } });
    result.error = message;
  }
  return result;
}

/**
 * Avviso di una nuova email del cliente: al referente; se non c'è o non è attivo, agli amministratori,
 * altrimenti l'email non la vedrebbe nessuno finché qualcuno non apre la posta.
 */
async function avvisaEmailCliente(clientId: string, emailId: string, oggetto: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { denominazione: true, referenteId: true } });
  if (!client) return;
  const avviso = { tipo: "EMAIL_CLIENTE" as const, titolo: `Email da ${client.denominazione}`, corpo: truncate(oggetto, 120), link: `/email/${emailId}` };
  const alReferente = client.referenteId ? await notify({ ...avviso, userId: client.referenteId }) : null;
  if (!alReferente) await notifyAdmins({ ...avviso, titolo: `Email da ${client.denominazione} (cliente senza referente attivo)` });
}

/** Sincronizza tutti gli account Gmail collegati. */
export async function syncAllGoogleAccounts() {
  const accounts = await prisma.googleAccount.findMany({ select: { id: true } });
  const results: Record<string, SyncResult> = {};
  for (const a of accounts) results[a.id] = await syncGoogleAccount(a.id, "CRON");
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
