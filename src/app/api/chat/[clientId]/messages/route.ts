import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuthError, requireStaffAction } from "@/lib/auth/guards";
import { CHAT_MAX_LEN, createChatMessage, getChatMessages, markChatRead, toChatDto } from "@/modules/chat/service";

type Ctx = { params: Promise<{ clientId: string }> };

async function guard() {
  try {
    return { user: await requireStaffAction() };
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 401;
    return { response: NextResponse.json({ error: (e as Error).message }, { status }) };
  }
}

/** Messaggi della chat di un cliente; con ?after=<ISO> solo quelli successivi (polling). Aggiorna la lettura. */
export async function GET(request: NextRequest, ctx: Ctx) {
  const g = await guard();
  if (g.response) return g.response;
  const { clientId } = await ctx.params;
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });

  const afterRaw = request.nextUrl.searchParams.get("after");
  const after = afterRaw ? new Date(afterRaw) : null;
  const messages = await getChatMessages(clientId, { after: after && !isNaN(after.getTime()) ? after : undefined });
  await markChatRead(g.user.id, clientId);
  return NextResponse.json({ messages: messages.map(toChatDto) });
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
