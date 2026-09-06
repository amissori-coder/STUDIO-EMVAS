import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { canAccessClient, type CurrentUser } from "@/lib/auth/guards";
import { DOCUMENT_INCLUDE, toDocumentDto } from "@/modules/documenti/service";
import { buildFolderTree, type DocumentDto, type FolderNode } from "@/modules/documenti/shared";

export const PORTAL_CLIENT_COOKIE = "emvas_portale_cliente";

export interface PortalClient {
  id: string;
  denominazione: string;
  referente: { nome: string; email: string; telefono: string | null } | null;
}

/** Clienti (attivi) a cui l'utente del portale ha accesso. */
export async function getPortalClients(user: CurrentUser): Promise<PortalClient[]> {
  if (user.clientIds.length === 0) return [];
  return prisma.client.findMany({
    where: { id: { in: user.clientIds }, attivo: true },
    select: { id: true, denominazione: true, referente: { select: { nome: true, email: true, telefono: true } } },
    orderBy: { denominazione: "asc" },
  });
}

/** Cliente corrente: parametro ?cliente= (se valido), poi cookie, poi il primo disponibile. */
export async function resolvePortalClient(clients: PortalClient[], requestedId?: string | null): Promise<PortalClient | null> {
  if (clients.length === 0) return null;
  if (requestedId) {
    const c = clients.find((x) => x.id === requestedId);
    if (c) return c;
  }
  const store = await cookies();
  const fromCookie = store.get(PORTAL_CLIENT_COOKIE)?.value;
  if (fromCookie) {
    const c = clients.find((x) => x.id === fromCookie);
    if (c) return c;
  }
  return clients[0]!;
}

export interface PortalFolder {
  id: string;
  clientId: string;
  nome: string;
  descrizione: string | null;
  parentId: string | null;
  clientePuoCaricare: boolean;
  /** documenti direttamente nella cartella */
  count: number;
  /** data dell'ultimo caricamento nella cartella */
  ultimoCaricamento: string | null;
  children: PortalFolder[];
}

/**
 * Albero delle cartelle visibili al cliente: una cartella è visibile solo se lo sono anche tutte le antenate.
 * Include conteggio e data ultimo caricamento.
 */
export async function getPortalFolderTree(clientId: string): Promise<PortalFolder[]> {
  const folders = await prisma.documentFolder.findMany({
    where: { clientId, visibileCliente: true },
    orderBy: [{ ordine: "asc" }, { nome: "asc" }],
    include: {
      _count: { select: { documenti: true } },
      documenti: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const nodes = buildFolderTree(
    folders.map((f) => ({
      id: f.id,
      clientId: f.clientId,
      nome: f.nome,
      descrizione: f.descrizione,
      parentId: f.parentId,
      visibileCliente: f.visibileCliente,
      clientePuoCaricare: f.clientePuoCaricare,
      ordine: f.ordine,
      count: f._count.documenti,
    })),
  );
  // buildFolderTree considera "radice" anche chi ha un padre non presente (perché nascosto): scartiamo quei rami.
  const last = new Map(folders.map((f) => [f.id, f.documenti[0]?.createdAt.toISOString() ?? null]));
  const convert = (n: FolderNode): PortalFolder => ({
    id: n.id,
    clientId: n.clientId,
    nome: n.nome,
    descrizione: n.descrizione,
    parentId: n.parentId,
    clientePuoCaricare: n.clientePuoCaricare,
    count: n.count,
    ultimoCaricamento: last.get(n.id) ?? null,
    children: n.children.map(convert),
  });
  return nodes.filter((n) => !n.parentId).map(convert);
}

function collectIds(nodes: PortalFolder[], out: string[] = []) {
  for (const n of nodes) {
    out.push(n.id);
    collectIds(n.children, out);
  }
  return out;
}

function findNode(nodes: PortalFolder[], id: string, chain: PortalFolder[] = []): PortalFolder[] | null {
  for (const n of nodes) {
    const next = [...chain, n];
    if (n.id === id) return next;
    const found = findNode(n.children, id, next);
    if (found) return found;
  }
  return null;
}

/**
 * Cartella del portale con la catena delle antenate (breadcrumb). Null se non esiste, non è del cliente
 * a cui l'utente ha accesso, oppure non è visibile.
 */
export async function getPortalFolder(user: CurrentUser, folderId: string): Promise<{ chain: PortalFolder[]; folder: PortalFolder; clientId: string } | null> {
  const base = await prisma.documentFolder.findUnique({ where: { id: folderId }, select: { id: true, clientId: true } });
  if (!base || !canAccessClient(user, base.clientId)) return null;
  const client = await prisma.client.findUnique({ where: { id: base.clientId }, select: { attivo: true } });
  if (!client?.attivo) return null;
  const tree = await getPortalFolderTree(base.clientId);
  const chain = findNode(tree, folderId);
  if (!chain) return null;
  return { chain, folder: chain[chain.length - 1]!, clientId: base.clientId };
}

/** Documenti di una cartella visibile (più recenti prima). */
export async function getPortalFolderDocuments(folderId: string): Promise<DocumentDto[]> {
  const docs = await prisma.document.findMany({ where: { folderId }, include: DOCUMENT_INCLUDE, orderBy: { createdAt: "desc" }, take: 500 });
  return docs.map(toDocumentDto);
}

/** Ultimi documenti visibili al cliente (in cartelle visibili oppure caricati da lui senza cartella). */
export async function getPortalRecentDocuments(user: CurrentUser, clientId: string, limit = 8): Promise<DocumentDto[]> {
  const tree = await getPortalFolderTree(clientId);
  const ids = collectIds(tree);
  const docs = await prisma.document.findMany({
    where: { clientId, OR: [{ folderId: { in: ids } }, { folderId: null, daCliente: true, uploadedById: user.id }] },
    include: DOCUMENT_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return docs.map(toDocumentDto);
}

/** Indirizzo email dello studio da mostrare nel footer del portale (da SMTP_FROM o VAPID_SUBJECT). */
export function getStudioContactEmail(): string | null {
  const from = process.env.SMTP_FROM ?? "";
  const m = /<([^>]+)>/.exec(from) ?? /([^\s<>]+@[^\s<>]+)/.exec(from);
  if (m?.[1]) return m[1];
  const subj = process.env.VAPID_SUBJECT ?? "";
  if (subj.startsWith("mailto:")) return subj.slice(7);
  return null;
}
