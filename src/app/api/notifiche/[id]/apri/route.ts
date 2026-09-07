import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { AuthError, requireUserAction } from "@/lib/auth/guards";
import { resolveInternalLink } from "@/modules/notifiche/link";

/**
 * Apre una notifica: la segna come letta e reindirizza al link salvato.
 * Solo notifiche dell'utente corrente e solo link interni (percorsi assoluti della stessa origine).
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

  return NextResponse.redirect(resolveInternalLink(n.link, request.url) ?? fallback);
}
