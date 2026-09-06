import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuthError, canAccessClient, isStaff, requireUserAction } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { getMaxUploadBytes, isAllowedFilename, saveUpload } from "@/lib/storage";
import { formatBytes } from "@/lib/utils";
import { DOCUMENT_INCLUDE, isFolderVisibleToClient, toDocumentDto } from "@/modules/documenti/service";
import { guessMimeType, MAX_FILES_PER_UPLOAD, type UploadResponse } from "@/modules/documenti/shared";

export const runtime = "nodejs";

function json(body: UploadResponse, status = 200) {
  return NextResponse.json(body, { status });
}

const fieldsSchema = z.object({
  clientId: z.string().trim().min(1, "Cliente mancante."),
  folderId: z.string().trim().optional().or(z.literal("")),
  note: z.string().trim().max(1000, "Nota troppo lunga (massimo 1000 caratteri).").optional().or(z.literal("")),
});

/**
 * Carica uno o più file tra i documenti di un cliente.
 * Multipart: clientId, folderId (facoltativo per lo staff), note (facoltativa), files (uno o più).
 * Risposta: { ok, documenti } oppure { error }.
 */
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireUserAction();
  } catch (e) {
    return json({ error: (e as Error).message }, e instanceof AuthError ? e.status : 401);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "Richiesta non valida: atteso un modulo multipart." }, 400);
  }

  const parsed = fieldsSchema.safeParse({
    clientId: formData.get("clientId"),
    folderId: formData.get("folderId") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Dati non validi." }, 400);
  const { clientId } = parsed.data;
  const folderId = parsed.data.folderId || null;
  const note = parsed.data.note || null;

  if (!canAccessClient(user, clientId)) return json({ error: "Accesso al cliente non consentito." }, 403);
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, denominazione: true, referenteId: true, attivo: true } });
  if (!client) return json({ error: "Cliente non trovato." }, 404);

  const staff = isStaff(user);
  if (!staff && !folderId) return json({ error: "Scegli una cartella in cui caricare i documenti." }, 400);

  if (folderId) {
    const folder = await prisma.documentFolder.findUnique({ where: { id: folderId }, select: { id: true, clientId: true, clientePuoCaricare: true, nome: true } });
    if (!folder || folder.clientId !== clientId) return json({ error: "Cartella non trovata." }, 404);
    if (!staff) {
      if (!(await isFolderVisibleToClient(folder.id))) return json({ error: "Cartella non trovata." }, 404);
      if (!folder.clientePuoCaricare) return json({ error: "In questa cartella non è possibile caricare documenti: contatta lo studio." }, 403);
    }
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size >= 0 && !!f.name);
  if (files.length === 0) return json({ error: "Nessun file selezionato." }, 400);
  if (files.length > MAX_FILES_PER_UPLOAD) return json({ error: `Puoi caricare al massimo ${MAX_FILES_PER_UPLOAD} file per volta.` }, 400);

  const max = getMaxUploadBytes();
  for (const f of files) {
    if (f.size <= 0) return json({ error: `Il file "${f.name}" è vuoto.` }, 400);
    if (f.size > max) return json({ error: `Il file "${f.name}" supera la dimensione massima di ${formatBytes(max)}.` }, 413);
    if (!isAllowedFilename(f.name)) return json({ error: `Il tipo di file "${f.name}" non è consentito.` }, 400);
  }

  const daCliente = user.ruolo === "CLIENTE";
  const created = [];
  try {
    for (const f of files) {
      const data = Buffer.from(await f.arrayBuffer());
      const storagePath = await saveUpload({ clientId, originalName: f.name, data });
      const doc = await prisma.document.create({
        data: {
          clientId,
          folderId,
          nome: f.name.slice(0, 255),
          mimeType: guessMimeType(f.name, f.type),
          size: data.length,
          storagePath,
          uploadedById: user.id,
          daCliente,
          note,
        },
        include: DOCUMENT_INCLUDE,
      });
      created.push(doc);
    }
  } catch (e) {
    console.error("[documenti/upload]", e);
    if (created.length === 0) return json({ error: "Errore durante il salvataggio dei file. Riprova." }, 500);
  }

  await audit({
    userId: user.id,
    azione: daCliente ? "DOCUMENTO_CARICATO_CLIENTE" : "DOCUMENTO_CARICATO",
    entita: "Document",
    entitaId: created.length === 1 ? created[0]!.id : null,
    dettagli: { clientId, folderId, files: created.map((d) => ({ id: d.id, nome: d.nome, size: d.size })), note },
  });

  if (daCliente && client.referenteId) {
    const nomi = created.map((d) => d.nome);
    const elenco = nomi.slice(0, 5).join(", ") + (nomi.length > 5 ? ` e altri ${nomi.length - 5}` : "");
    await notify({
      userId: client.referenteId,
      tipo: "DOCUMENTO_CARICATO",
      titolo: created.length === 1 ? `Nuovo documento da ${client.denominazione}` : `${created.length} nuovi documenti da ${client.denominazione}`,
      corpo: `${user.nome} ha caricato: ${elenco}${note ? ` — «${note}»` : ""}`,
      link: `/clienti/${clientId}?tab=documenti`,
    });
  }

  revalidatePath(`/clienti/${clientId}`);
  revalidatePath("/portale");
  if (folderId) revalidatePath(`/portale/cartelle/${folderId}`);

  const status = created.length < files.length ? 207 : 201;
  return json({ ok: true, documenti: created.map(toDocumentDto), ...(created.length < files.length ? { error: "Alcuni file non sono stati salvati." } : {}) }, status);
}
