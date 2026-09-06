import { notFound } from "next/navigation";
import type { CurrentUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { ChatConversation } from "./ChatConversation";
import { getChatMessages, listStaffUsers, markChatRead, toChatDto } from "./service";

/**
 * Pannello chat del cliente: carica i messaggi iniziali e l'elenco dello staff (per le menzioni)
 * e renderizza la conversazione interattiva. Usato nella scheda cliente e in /chat/[clientId].
 */
export async function ClientChatPanel({ clientId, user, heightClass = "h-[70vh]" }: { clientId: string; user: CurrentUser; heightClass?: string }) {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) notFound();
  const [messages, staff] = await Promise.all([getChatMessages(clientId), listStaffUsers()]);
  await markChatRead(user.id, clientId);
  return (
    <ChatConversation
      clientId={clientId}
      currentUser={{ id: user.id, nome: user.nome, ruolo: user.ruolo }}
      staff={staff}
      initialMessages={messages.map(toChatDto)}
      heightClass={heightClass}
    />
  );
}
