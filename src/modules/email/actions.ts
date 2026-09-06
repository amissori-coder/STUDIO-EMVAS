"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuthError, requireStaffAction } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { fetchGmailAttachment, syncAllGoogleAccounts, syncGoogleAccount, type SyncResult } from "@/lib/gmail";
import { getMaxUploadBytes, isAllowedFilename, saveUpload } from "@/lib/storage";
import { formatBytes, truncate } from "@/lib/utils";
import { parseAttachments } from "./queries";

export interface ActionResult {
  ok?: boolean;
  error?: string;
  message?: string;
}

function errorMessage(e: unknown) {
  if (e instanceof AuthError) return e.message;
  const msg = (e as Error)?.message?.replace(/\s+/g, " ").trim();
  return msg ? truncate(msg, 300) : "Si è verificato un errore.";
}

function revalidateEmail(id: string, clientIds: (string | null | undefined)[] = []) {
  revalidatePath("/email");
  revalidatePath(`/email/${id}`);
  for (const c of clientIds) if (c) revalidatePath(`/clienti/${c}`);
}

// ---------------------------------------------------------------------------
// Sincronizzazione
// ---------------------------------------------------------------------------
export async function syncNowAction(): Promise<ActionResult> {
  try {
    const user = await requireStaffAction();
    let results: SyncResult[] = [];
    if (user.ruolo === "ADMIN") {
      results = Object.values(await syncAllGoogleAccounts());
    } else {
      const account = await prisma.googleAccount.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (!account) return { error: "Non hai una casella Gmail collegata: collegala dalle Impostazioni." };
      results = [await syncGoogleAccount(account.id)];
    }
    revalidatePath("/email");
    if (!results.length) return { error: "Nessuna casella Gmail collegata." };
    const imported = results.reduce((s, r) => s + r.imported, 0);
    const linked = results.reduce((s, r) => s + r.linked, 0);
    const errors = results.map((r) => r.error?.replace(/\s+/g, " ")).filter(Boolean) as string[];
    await audit({ userId: user.id, azione: "EMAIL_SYNC", entita: "GoogleAccount", dettagli: { caselle: results.length, imported, linked, errors } });
    if (errors.length) {
      return { error: `Sincronizzazione con errori: ${truncate(errors.join(" · "), 300)}${imported ? ` (importate comunque ${imported} email)` : ""}` };
    }
    return {
      ok: true,
      message: `Sincronizzazione completata: ${imported} ${imported === 1 ? "nuova email importata" : "nuove email importate"}, ${linked} ${linked === 1 ? "associata" : "associate"} automaticamente a un cliente.`,
    };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

// ---------------------------------------------------------------------------
// Associazione cliente / attività
// ---------------------------------------------------------------------------
const linkSchema = z.object({
  emailId: z.string().min(1),
  clientId: z.string().min(1, "Seleziona un cliente."),
  taskId: z.string().optional(),
});

export async function linkEmailAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireStaffAction();
    const parsed = linkSchema.safeParse({
      emailId: String(formData.get("emailId") ?? ""),
      clientId: String(formData.get("clientId") ?? ""),
      taskId: String(formData.get("taskId") ?? "") || undefined,
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
    const { emailId, clientId, taskId } = parsed.data;

    const email = await prisma.emailMessage.findUnique({ where: { id: emailId }, select: { id: true, clientId: true, subject: true } });
    if (!email) return { error: "Email non trovata." };
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, denominazione: true, referenteId: true } });
    if (!client) return { error: "Cliente non trovato." };

    let validTaskId: string | null = null;
    if (taskId) {
      const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true, clientId: true } });
      if (!task || task.clientId !== clientId) return { error: "L'attività selezionata non appartiene al cliente scelto." };
      validTaskId = task.id;
    }

    await prisma.emailMessage.update({
      where: { id: emailId },
      data: { clientId, taskId: validTaskId, linkAuto: false, linkedById: user.id, linkedAt: new Date() },
    });
    await audit({
      userId: user.id,
      azione: "EMAIL_ASSOCIATA",
      entita: "EmailMessage",
      entitaId: emailId,
      dettagli: { clientId, taskId: validTaskId, precedente: email.clientId },
    });
    if (client.referenteId && client.referenteId !== user.id && email.clientId !== clientId) {
      await notify({
        userId: client.referenteId,
        tipo: "EMAIL_CLIENTE",
        titolo: `Email associata a ${client.denominazione}`,
        corpo: `${user.nome}: ${truncate(email.subject, 120)}`,
        link: `/email/${emailId}`,
      });
    }
    revalidateEmail(emailId, [clientId, email.clientId]);
    return { ok: true, message: `Email associata a ${client.denominazione}.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function unlinkEmailAction(emailId: string): Promise<ActionResult> {
  try {
    const user = await requireStaffAction();
    const id = z.string().min(1).parse(emailId);
    const email = await prisma.emailMessage.findUnique({ where: { id }, select: { id: true, clientId: true, taskId: true } });
    if (!email) return { error: "Email non trovata." };
    await prisma.emailMessage.update({
      where: { id },
      data: { clientId: null, taskId: null, linkAuto: false, linkedById: user.id, linkedAt: new Date() },
    });
    await audit({
      userId: user.id,
      azione: "EMAIL_DISSOCIATA",
      entita: "EmailMessage",
      entitaId: id,
      dettagli: { precedenteClientId: email.clientId, precedenteTaskId: email.taskId },
    });
    revalidateEmail(id, [email.clientId]);
    return { ok: true, message: "Associazione rimossa." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function toggleArchiveEmailAction(emailId: string): Promise<ActionResult> {
  try {
    const user = await requireStaffAction();
    const id = z.string().min(1).parse(emailId);
    const email = await prisma.emailMessage.findUnique({ where: { id }, select: { id: true, archiviata: true, clientId: true } });
    if (!email) return { error: "Email non trovata." };
    const archiviata = !email.archiviata;
    await prisma.emailMessage.update({ where: { id }, data: { archiviata } });
    await audit({ userId: user.id, azione: archiviata ? "EMAIL_ARCHIVIATA" : "EMAIL_RIPRISTINATA", entita: "EmailMessage", entitaId: id });
    revalidateEmail(id, [email.clientId]);
    return { ok: true, message: archiviata ? "Email archiviata." : "Email ripristinata." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

// ---------------------------------------------------------------------------
// Salvataggio allegato tra i documenti del cliente
// ---------------------------------------------------------------------------
const attachmentSchema = z.object({
  emailId: z.string().min(1),
  attachmentId: z.string().min(1),
  folderId: z.string().optional(),
});

export async function saveAttachmentAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireStaffAction();
    const parsed = attachmentSchema.safeParse({
      emailId: String(formData.get("emailId") ?? ""),
      attachmentId: String(formData.get("attachmentId") ?? ""),
      folderId: String(formData.get("folderId") ?? "") || undefined,
    });
    if (!parsed.success) return { error: "Dati non validi." };
    const { emailId, attachmentId, folderId } = parsed.data;

    const email = await prisma.emailMessage.findUnique({
      where: { id: emailId },
      select: { id: true, accountId: true, gmailId: true, clientId: true, taskId: true, attachments: true },
    });
    if (!email) return { error: "Email non trovata." };
    if (!email.clientId) return { error: "Associa prima l'email a un cliente per salvarne gli allegati." };
    const att = parseAttachments(email.attachments).find((a) => a.attachmentId === attachmentId);
    if (!att) return { error: "Allegato non trovato." };
    if (!isAllowedFilename(att.filename)) return { error: "Tipo di file non consentito." };
    const max = getMaxUploadBytes();
    if (att.size > max) return { error: `Allegato troppo grande (massimo ${formatBytes(max)}).` };

    let folder: { id: string } | null = null;
    if (folderId) {
      folder = await prisma.documentFolder.findFirst({ where: { id: folderId, clientId: email.clientId }, select: { id: true } });
      if (!folder) return { error: "Cartella non valida." };
    } else {
      folder =
        (await prisma.documentFolder.findFirst({ where: { clientId: email.clientId, nome: "Altro" }, select: { id: true } })) ??
        (await prisma.documentFolder.findFirst({ where: { clientId: email.clientId }, orderBy: { ordine: "asc" }, select: { id: true } }));
    }

    const data = await fetchGmailAttachment(email.accountId, email.gmailId, attachmentId);
    if (data.length > max) return { error: `Allegato troppo grande (massimo ${formatBytes(max)}).` };
    const storagePath = await saveUpload({ clientId: email.clientId, originalName: att.filename, data });
    const doc = await prisma.document.create({
      data: {
        clientId: email.clientId,
        folderId: folder?.id ?? null,
        nome: att.filename,
        mimeType: att.mimeType || "application/octet-stream",
        size: data.length,
        storagePath,
        uploadedById: user.id,
        emailId: email.id,
        taskId: email.taskId,
      },
    });
    await audit({
      userId: user.id,
      azione: "EMAIL_ALLEGATO_SALVATO",
      entita: "Document",
      entitaId: doc.id,
      dettagli: { emailId: email.id, clientId: email.clientId, folderId: folder?.id ?? null, nome: att.filename, size: data.length },
    });
    revalidateEmail(emailId, [email.clientId]);
    return { ok: true, message: `"${att.filename}" salvato tra i documenti del cliente.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
