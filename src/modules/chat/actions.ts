"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuthError, requireStaffAction } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { CHAT_MAX_LEN, createChatMessage, toChatDto, type ChatMessageDto } from "./service";

export interface ChatActionResult {
  ok?: boolean;
  error?: string;
  message?: ChatMessageDto;
}

function errorMessage(e: unknown) {
  if (e instanceof AuthError) return e.message;
  return (e as Error)?.message || "Si è verificato un errore.";
}

function revalidateChat(clientId: string) {
  revalidatePath("/chat");
  revalidatePath(`/chat/${clientId}`);
  revalidatePath(`/clienti/${clientId}`);
}

/** Invia un messaggio (alternativa alla POST /api/chat/[clientId]/messages). */
export async function sendChatMessageAction(clientId: string, testo: string): Promise<ChatActionResult> {
  try {
    const user = await requireStaffAction();
    const parsed = z
      .object({ clientId: z.string().min(1), testo: z.string().trim().min(1, "Scrivi un messaggio.").max(CHAT_MAX_LEN, "Messaggio troppo lungo.") })
      .safeParse({ clientId, testo });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
    const message = await createChatMessage({ clientId: parsed.data.clientId, author: user, testo: parsed.data.testo });
    revalidateChat(parsed.data.clientId);
    return { ok: true, message: toChatDto(message) };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

/** Elimina un messaggio: l'autore può eliminare i propri, l'amministratore qualsiasi. */
export async function deleteChatMessageAction(messageId: string): Promise<ChatActionResult> {
  try {
    const user = await requireStaffAction();
    const id = z.string().min(1).parse(messageId);
    const msg = await prisma.chatMessage.findUnique({ where: { id }, select: { id: true, authorId: true, clientId: true, testo: true } });
    if (!msg) return { error: "Messaggio non trovato." };
    if (msg.authorId !== user.id && user.ruolo !== "ADMIN") return { error: "Puoi eliminare solo i tuoi messaggi." };
    await prisma.chatMessage.delete({ where: { id } });
    await audit({
      userId: user.id,
      azione: "CHAT_MESSAGGIO_ELIMINATO",
      entita: "ChatMessage",
      entitaId: id,
      dettagli: { clientId: msg.clientId, authorId: msg.authorId, testo: msg.testo.slice(0, 500) },
    });
    revalidateChat(msg.clientId);
    return { ok: true };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
