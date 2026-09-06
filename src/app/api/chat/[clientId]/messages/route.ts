import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuthError, requireStaffAction } from "@/lib/auth/guards";
import {
  CHAT_MAX_LEN,
  chatMessageSelect,
  countChatMessagesSince,
  createChatMessage,
  getChatMessages,
  hasOlderChatMessages,
  markChatRead,
  toChatDto,
} from "@/modules/chat/service";

type Ctx = { params: Promise<{ clientId: string }> };

/** Massimo di messaggi restituiti quando il client ricarica l'intera finestra visualizzata. */
const CHAT_RELOAD_LIMIT = 2000;

async function guard() {
  try {
    return { user: await requireStaffAction() };
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 401;
    return { response: NextResponse.json({ error: (e as Error).message }, { status }) };
  }
}

function parseDateParam(request: NextRequest, name: string): Date | undefined {
  const raw = request.nextUrl.searchParams.get(name);
  if (!raw) return undefined;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? undefined : d;
}

/**
 * Messaggi della chat di un cliente. Aggiorna la lettura.
 * - `?after=<ISO>`: solo i messaggi successivi (polling);
 * - `?before=<ISO>`: gli ultimi messaggi precedenti a quella data (storico), con `hasMore`;
 * - `?from=<ISO>`: aggiunge `count` = numero di messaggi con data >= from, così il client può
 *   accorgersi delle eliminazioni fatte da altri; senza `after`/`before` restituisce l'intera finestra da `from`.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const g = await guard();
  if (g.response) return g.response;
  const { clientId } = await ctx.params;
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });

  const after = parseDateParam(request, "after");
  const before = parseDateParam(request, "before");
  const from = parseDateParam(request, "from");

  if (before) {
    const messages = await getChatMessages(clientId, { before });
    const hasMore = await hasOlderChatMessages(clientId, messages[0]?.createdAt);
    return NextResponse.json({ messages: messages.map(toChatDto), hasMore });
  }

  let messages;
  if (after) {
    messages = await getChatMessages(clientId, { after });
  } else if (from) {
    // Ricarica completa della finestra già visualizzata (riconciliazione dopo un'eliminazione)
    messages = await prisma.chatMessage.findMany({
      where: { clientId, createdAt: { gte: from } },
      select: chatMessageSelect,
      orderBy: { createdAt: "asc" },
      take: CHAT_RELOAD_LIMIT,
    });
  } else {
    messages = await getChatMessages(clientId);
  }
  const count = from ? await countChatMessagesSince(clientId, from) : undefined;
  await markChatRead(g.user.id, clientId);
  return NextResponse.json({ messages: messages.map(toChatDto), ...(count !== undefined ? { count } : {}) });
}

const bodySchema = z.object({
  testo: z.string().trim().min(1, "Scrivi un messaggio.").max(CHAT_MAX_LEN, `Messaggio troppo lungo (massimo ${CHAT_MAX_LEN} caratteri).`),
});

/** Invia un nuovo messaggio nella chat del cliente. */
export async function POST(request: NextRequest, ctx: Ctx) {
  const g = await guard();
  if (g.response) return g.response;
  const { clientId } = await ctx.params;
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo della richiesta non valido" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dati non validi" }, { status: 400 });

  const message = await createChatMessage({ clientId, author: g.user, testo: parsed.data.testo });
  revalidatePath("/chat");
  revalidatePath(`/chat/${clientId}`);
  revalidatePath(`/clienti/${clientId}`);
  return NextResponse.json({ message: toChatDto(message) }, { status: 201 });
}
