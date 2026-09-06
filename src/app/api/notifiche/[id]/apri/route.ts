import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { AuthError, requireUserAction } from "@/lib/auth/guards";

/**
 * Apre una notifica: la segna come letta e reindirizza al link salvato.
 * Solo notifiche dell'utente corrente e solo link interni (che iniziano con "/").
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/notifiche/[id]/apri">) {
  let userId: string;
  let ruolo: string;
  try {
    const user = await requireUserAction();
    userId = user.id;
    ruolo = user.ruolo;
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 401;
    return NextResponse.json({ error: "Non autenticato" }, { status });
  }
  const fallback = new URL(ruolo === "CLIENTE" ? "/portale" : "/notifiche", request.url);
  const { id } = await ctx.params;
  const n = await prisma.notification.findFirst({ where: { id, userId }, select: { id: true, link: true, letta: true } });
  if (!n) return NextResponse.redirect(fallback);
  if (!n.letta) await prisma.notification.update({ where: { id: n.id }, data: { letta: new Date() } });

  const link = n.link && n.link.startsWith("/") && !n.link.startsWith("//") ? n.link : null;
  return NextResponse.redirect(link ? new URL(link, request.url) : fallback);
}
