import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canAccessClient, isStaff, type CurrentUser } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { deleteUpload } from "@/lib/storage";
import { formatDateTime } from "@/lib/utils";
import { buildFolderTree, type DocumentDto, type FolderDto, type FolderNode } from "./shared";

export const DOCUMENT_INCLUDE = {
  uploadedBy: { select: { id: true, nome: true } },
  email: { select: { id: true, subject: true } },
  task: { select: { id: true, titolo: true } },
} satisfies Prisma.DocumentInclude;

export type DocumentWithRefs = Prisma.DocumentGetPayload<{ include: typeof DOCUMENT_INCLUDE }>;

export function toDocumentDto(d: DocumentWithRefs): DocumentDto {
  return {
    id: d.id,
    clientId: d.clientId,
    folderId: d.folderId,
    nome: d.nome,
    mimeType: d.mimeType,
    size: d.size,
    daCliente: d.daCliente,
    note: d.note,
    createdAt: d.createdAt.toISOString(),
    createdAtLabel: formatDateTime(d.createdAt),
    uploadedBy: d.uploadedBy ? { id: d.uploadedBy.id, nome: d.uploadedBy.nome } : null,
    email: d.email ? { id: d.email.id, subject: d.email.subject } : null,
    task: d.task ? { id: d.task.id, titolo: d.task.titolo } : null,
  };
}

/** Elenco piatto delle cartelle di un cliente con conteggio documenti. */
export async function getFolderList(clientId: string): Promise<FolderDto[]> {
  const folders = await prisma.documentFolder.findMany({
    where: { clientId },
    orderBy: [{ ordine: "asc" }, { nome: "asc" }],
    include: { _count: { select: { documenti: true } } },
  });
  return folders.map((f) => ({
    id: f.id,
    clientId: f.clientId,
    nome: f.nome,
    descrizione: f.descrizione,
    parentId: f.parentId,
    visibileCliente: f.visibileCliente,
    clientePuoCaricare: f.clientePuoCaricare,
    ordine: f.ordine,
    count: f._count.documenti,
  }));
}

/** Albero delle cartelle di un cliente (cartelle principali con figlie annidate e conteggi). */
export async function getFolderTree(clientId: string): Promise<FolderNode[]> {
  return buildFolderTree(await getFolderList(clientId));
}

/** Documenti di un cliente (più recenti prima). */
export async function getClientDocuments(clientId: string, opts: { limit?: number; folderId?: string | null } = {}) {
  const docs = await prisma.document.findMany({
    where: { clientId, ...(opts.folderId !== undefined ? { folderId: opts.folderId } : {}) },
    include: DOCUMENT_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 500,
  });
  return docs.map(toDocumentDto);
}

/**
 * Restituisce la cartella se è visibile al cliente (essa e tutte le cartelle antenate hanno visibileCliente=true),
 * altrimenti null. Per lo staff tutte le cartelle sono visibili.
 */
export async function isFolderVisibleToClient(folderId: string): Promise<boolean> {
  let currentId: string | null = folderId;
  for (let depth = 0; currentId && depth < 20; depth++) {
    const f: { visibileCliente: boolean; parentId: string | null } | null = await prisma.documentFolder.findUnique({
      where: { id: currentId },
      select: { visibileCliente: true, parentId: true },
    });
    if (!f || !f.visibileCliente) return false;
    currentId = f.parentId;
  }
  return true;
}

/**
 * Un utente CLIENTE può operare sui documenti di un cliente solo se vi ha accesso e il cliente è ancora attivo
 * (il portale nasconde i clienti archiviati: le API devono comportarsi allo stesso modo).
 */
export async function canClientUserAccess(user: CurrentUser, clientId: string) {
  if (!canAccessClient(user, clientId)) return false;
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { attivo: true } });
  return !!client?.attivo;
}

/** Chi ha caricato il documento può vederlo anche se è senza cartella (es. cartella eliminata). */
export async function canUserViewDocument(user: CurrentUser, doc: { clientId: string; folderId: string | null; daCliente: boolean; uploadedById: string | null }) {
  if (isStaff(user)) return true;
  if (!(await canClientUserAccess(user, doc.clientId))) return false;
  if (doc.daCliente && doc.uploadedById === user.id) return true;
  if (!doc.folderId) return false;
  return isFolderVisibleToClient(doc.folderId);
}

export async function canUserDeleteDocument(user: CurrentUser, doc: { clientId: string; daCliente: boolean; uploadedById: string | null }) {
  if (isStaff(user)) return true;
  if (!doc.daCliente || doc.uploadedById !== user.id) return false;
  return canClientUserAccess(user, doc.clientId);
}

/** Elimina file e riga del documento, registrando l'audit. Non verifica i permessi. */
export async function removeDocument(user: CurrentUser, doc: { id: string; clientId: string; nome: string; storagePath: string; folderId: string | null; daCliente: boolean }) {
  await prisma.document.delete({ where: { id: doc.id } });
  await deleteUpload(doc.storagePath).catch((e) => console.error("[documenti] eliminazione file fallita:", e));
  await audit({
    userId: user.id,
    azione: "DOCUMENTO_ELIMINATO",
    entita: "Document",
    entitaId: doc.id,
    dettagli: { clientId: doc.clientId, nome: doc.nome, folderId: doc.folderId, daCliente: doc.daCliente, ruolo: user.ruolo },
  });
}

/** Header Content-Disposition con nome file codificato (RFC 5987) e fallback ASCII. */
export function contentDisposition(filename: string, inline: boolean) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "file";
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
