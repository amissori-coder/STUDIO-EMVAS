"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuthError, requireStaffAction, requireUserAction } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { canUserDeleteDocument, removeDocument } from "./service";

export interface DocActionResult {
  ok?: boolean;
  error?: string;
  /** l'operazione richiede una conferma esplicita (es. cartella non vuota o con sottocartelle) */
  needsConfirm?: boolean;
  /** numero di documenti coinvolti */
  count?: number;
  /** numero di sottocartelle coinvolte */
  sottocartelle?: number;
  /** id dell'entità creata */
  id?: string;
}

function errorMessage(e: unknown, fallback = "Si è verificato un errore. Riprova.") {
  if (e instanceof AuthError) return e.message;
  console.error("[documenti]", e);
  return fallback;
}

function revalidateDocs(clientId: string, folderIds: (string | null | undefined)[] = []) {
  revalidatePath(`/clienti/${clientId}`);
  revalidatePath("/portale");
  for (const id of folderIds) if (id) revalidatePath(`/portale/cartelle/${id}`);
}

const folderSchema = z.object({
  clientId: z.string().min(1),
  nome: z.string().trim().min(1, "Inserisci il nome della cartella.").max(100, "Nome troppo lungo (massimo 100 caratteri)."),
  descrizione: z.string().trim().max(300, "Descrizione troppo lunga (massimo 300 caratteri).").optional().or(z.literal("")),
  parentId: z.string().trim().optional().or(z.literal("")),
  visibileCliente: z.boolean(),
  clientePuoCaricare: z.boolean(),
});

function readFolderForm(formData: FormData) {
  return folderSchema.safeParse({
    clientId: formData.get("clientId"),
    nome: formData.get("nome"),
    descrizione: formData.get("descrizione") ?? "",
    parentId: formData.get("parentId") ?? "",
    visibileCliente: formData.get("visibileCliente") === "on" || formData.get("visibileCliente") === "true",
    clientePuoCaricare: formData.get("clientePuoCaricare") === "on" || formData.get("clientePuoCaricare") === "true",
  });
}

/** Verifica che la cartella padre esista, appartenga al cliente e non sia la cartella stessa o una sua discendente. */
async function validateParent(clientId: string, parentId: string | undefined, selfId?: string): Promise<{ parentId: string | null } | { error: string }> {
  if (!parentId) return { parentId: null };
  if (selfId && parentId === selfId) return { error: "Una cartella non può essere contenuta in sé stessa." };
  let currentId: string | null = parentId;
  for (let depth = 0; currentId && depth < 20; depth++) {
    const f: { clientId: string; parentId: string | null } | null = await prisma.documentFolder.findUnique({ where: { id: currentId }, select: { clientId: true, parentId: true } });
    if (!f || f.clientId !== clientId) return { error: "Cartella padre non valida." };
    if (selfId && f.parentId === selfId) return { error: "Non puoi spostare una cartella dentro una sua sottocartella." };
    currentId = f.parentId;
  }
  return { parentId };
}

/** Crea una cartella (staff). Campi: clientId, nome, descrizione, parentId, visibileCliente, clientePuoCaricare. */
export async function createFolderAction(_prev: DocActionResult, formData: FormData): Promise<DocActionResult> {
  try {
    const user = await requireStaffAction();
    const parsed = readFolderForm(formData);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
    const { clientId, nome, descrizione, visibileCliente, clientePuoCaricare } = parsed.data;
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) return { error: "Cliente non trovato." };
    const parent = await validateParent(clientId, parsed.data.parentId || undefined);
    if ("error" in parent) return { error: parent.error };
    const last = await prisma.documentFolder.aggregate({ where: { clientId, parentId: parent.parentId }, _max: { ordine: true } });
    const folder = await prisma.documentFolder.create({
      data: {
        clientId,
        nome,
        descrizione: descrizione || null,
        parentId: parent.parentId,
        visibileCliente,
        clientePuoCaricare: visibileCliente && clientePuoCaricare,
        ordine: (last._max.ordine ?? -1) + 1,
      },
      select: { id: true },
    });
    await audit({ userId: user.id, azione: "CARTELLA_CREATA", entita: "DocumentFolder", entitaId: folder.id, dettagli: { clientId, nome, parentId: parent.parentId, visibileCliente, clientePuoCaricare } });
    revalidateDocs(clientId, [parent.parentId]);
    return { ok: true, id: folder.id };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

/** Modifica nome, descrizione, cartella padre e permessi di una cartella (staff). Campo aggiuntivo: folderId. */
export async function updateFolderAction(_prev: DocActionResult, formData: FormData): Promise<DocActionResult> {
  try {
    const user = await requireStaffAction();
    const folderId = z.string().min(1).safeParse(formData.get("folderId"));
    if (!folderId.success) return { error: "Cartella non valida." };
    const existing = await prisma.documentFolder.findUnique({ where: { id: folderId.data }, select: { id: true, clientId: true, parentId: true, nome: true } });
    if (!existing) return { error: "Cartella non trovata." };
    const parsed = readFolderForm(formData);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
    if (parsed.data.clientId !== existing.clientId) return { error: "Cartella non valida." };
    const parent = await validateParent(existing.clientId, parsed.data.parentId || undefined, existing.id);
    if ("error" in parent) return { error: parent.error };
    const { nome, descrizione, visibileCliente, clientePuoCaricare } = parsed.data;
    await prisma.documentFolder.update({
      where: { id: existing.id },
      data: { nome, descrizione: descrizione || null, parentId: parent.parentId, visibileCliente, clientePuoCaricare: visibileCliente && clientePuoCaricare },
    });
    await audit({ userId: user.id, azione: "CARTELLA_MODIFICATA", entita: "DocumentFolder", entitaId: existing.id, dettagli: { clientId: existing.clientId, nome, parentId: parent.parentId, visibileCliente, clientePuoCaricare } });
    revalidateDocs(existing.clientId, [existing.id, existing.parentId, parent.parentId]);
    return { ok: true, id: existing.id };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

/** Id della cartella e di tutte le discendenti. */
async function collectFolderIds(rootId: string): Promise<string[]> {
  const ids = [rootId];
  let frontier = [rootId];
  for (let depth = 0; frontier.length && depth < 20; depth++) {
    const children = await prisma.documentFolder.findMany({ where: { parentId: { in: frontier } }, select: { id: true } });
    frontier = children.map((c) => c.id);
    ids.push(...frontier);
  }
  return ids;
}

/**
 * Elimina una cartella (staff). Se contiene documenti (anche nelle sottocartelle) o sottocartelle serve
 * `conferma=true`: le sottocartelle vengono eliminate, i documenti restano disponibili in "Senza cartella".
 */
export async function deleteFolderAction(folderId: string, conferma = false): Promise<DocActionResult> {
  try {
    const user = await requireStaffAction();
    const id = z.string().min(1).parse(folderId);
    const folder = await prisma.documentFolder.findUnique({ where: { id }, select: { id: true, clientId: true, nome: true, parentId: true } });
    if (!folder) return { error: "Cartella non trovata." };
    const ids = await collectFolderIds(folder.id);
    const sottocartelle = ids.length - 1;
    const count = await prisma.document.count({ where: { folderId: { in: ids } } });
    if ((count > 0 || sottocartelle > 0) && !conferma) return { needsConfirm: true, count, sottocartelle };
    if (count > 0) await prisma.document.updateMany({ where: { folderId: { in: ids } }, data: { folderId: null } });
    await prisma.documentFolder.delete({ where: { id: folder.id } });
    await audit({ userId: user.id, azione: "CARTELLA_ELIMINATA", entita: "DocumentFolder", entitaId: folder.id, dettagli: { clientId: folder.clientId, nome: folder.nome, documentiSpostati: count, sottocartelle: ids.length - 1 } });
    revalidateDocs(folder.clientId, [folder.parentId, ...ids]);
    return { ok: true, count };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

/** Elimina un documento: lo staff può eliminare qualsiasi documento, il cliente solo quelli caricati da lui. */
export async function deleteDocumentAction(documentId: string): Promise<DocActionResult> {
  try {
    const user = await requireUserAction();
    const id = z.string().min(1).parse(documentId);
    const doc = await prisma.document.findUnique({
      where: { id },
      select: { id: true, clientId: true, nome: true, storagePath: true, folderId: true, daCliente: true, uploadedById: true },
    });
    if (!doc) return { error: "Documento non trovato." };
    if (!(await canUserDeleteDocument(user, doc))) return { error: "Non puoi eliminare questo documento." };
    await removeDocument(user, doc);
    revalidateDocs(doc.clientId, [doc.folderId]);
    return { ok: true };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

/** Aggiorna la nota di un documento (staff). */
export async function updateDocumentNoteAction(documentId: string, note: string): Promise<DocActionResult> {
  try {
    const user = await requireStaffAction();
    const parsed = z.object({ id: z.string().min(1), note: z.string().trim().max(1000, "Nota troppo lunga (massimo 1000 caratteri).") }).safeParse({ id: documentId, note });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
    const doc = await prisma.document.findUnique({ where: { id: parsed.data.id }, select: { id: true, clientId: true, folderId: true } });
    if (!doc) return { error: "Documento non trovato." };
    await prisma.document.update({ where: { id: doc.id }, data: { note: parsed.data.note || null } });
    await audit({ userId: user.id, azione: "DOCUMENTO_NOTA_MODIFICATA", entita: "Document", entitaId: doc.id, dettagli: { clientId: doc.clientId, note: parsed.data.note.slice(0, 200) } });
    revalidateDocs(doc.clientId, [doc.folderId]);
    return { ok: true };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

/** Sposta un documento in un'altra cartella dello stesso cliente (null = senza cartella) (staff). */
export async function moveDocumentAction(documentId: string, folderId: string | null): Promise<DocActionResult> {
  try {
    const user = await requireStaffAction();
    const parsed = z.object({ id: z.string().min(1), folderId: z.string().min(1).nullable() }).safeParse({ id: documentId, folderId: folderId || null });
    if (!parsed.success) return { error: "Dati non validi." };
    const doc = await prisma.document.findUnique({ where: { id: parsed.data.id }, select: { id: true, clientId: true, folderId: true, nome: true } });
    if (!doc) return { error: "Documento non trovato." };
    if (parsed.data.folderId) {
      const folder = await prisma.documentFolder.findUnique({ where: { id: parsed.data.folderId }, select: { clientId: true } });
      if (!folder || folder.clientId !== doc.clientId) return { error: "Cartella di destinazione non valida." };
    }
    if (doc.folderId === parsed.data.folderId) return { ok: true };
    await prisma.document.update({ where: { id: doc.id }, data: { folderId: parsed.data.folderId } });
    await audit({ userId: user.id, azione: "DOCUMENTO_SPOSTATO", entita: "Document", entitaId: doc.id, dettagli: { clientId: doc.clientId, nome: doc.nome, da: doc.folderId, a: parsed.data.folderId } });
    revalidateDocs(doc.clientId, [doc.folderId, parsed.data.folderId]);
    return { ok: true };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
