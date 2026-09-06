// Parsing puro dei messaggi Gmail (nessun accesso al DB): utilizzabile anche nei test.
import { normalizeEmail } from "@/lib/utils";

// ---- Tipi minimi della Gmail API ----
export interface GmailHeader { name: string; value: string }
export interface GmailPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailPart[];
}
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  payload?: GmailPart;
}
export interface GmailListResponse { messages?: { id: string; threadId: string }[]; nextPageToken?: string; resultSizeEstimate?: number }
export interface GmailHistoryResponse {
  history?: { id: string; messagesAdded?: { message: { id: string; threadId: string } }[] }[];
  nextPageToken?: string;
  historyId?: string;
}
export interface GmailProfile { emailAddress: string; historyId: string; messagesTotal?: number }

export interface ParsedAttachment { filename: string; mimeType: string; size: number; attachmentId: string }

export function decodeBase64Url(data: string) {
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

