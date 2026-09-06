import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuthError, requireUserAction } from "@/lib/auth/guards";

function authErrorResponse(e: unknown) {
  const status = e instanceof AuthError ? e.status : 401;
  return NextResponse.json({ error: e instanceof AuthError ? e.message : "Non autenticato" }, { status });
}

/** GET /api/notifiche?vista=non-lette|tutte&limit=20 — ultime notifiche dell'utente corrente (per polling client). */
export async function GET(request: NextRequest) {
  let userId: string;
  try {
    userId = (await requireUserAction()).id;
  } catch (e) {
    return authErrorResponse(e);
  }
  const sp = request.nextUrl.searchParams;
  const vista = sp.get("vista") === "tutte" ? "tutte" : "non-lette";
  const limit = Math.min(100, Math.max(1, Number.parseInt(sp.get("limit") ?? "20", 10) || 20));
  const where = { userId, ...(vista === "non-lette" ? { letta: null } : {}) };
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, tipo: true, titolo: true, corpo: true, link: true, letta: true, createdAt: true },
    }),
    prisma.notification.count({ where: { userId, letta: null } }),
  ]);
  return NextResponse.json({ items, unread });
}

const bodySchema = z.object({ ids: z.array(z.string().min(1)).max(200).optional(), all: z.boolean().optional() });

/** POST /api/notifiche { ids?: string[], all?: boolean } — segna come lette le notifiche indicate (o tutte). */
export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = (await requireUserAction()).id;
  } catch (e) {
    return authErrorResponse(e);
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  const { ids, all } = parsed.data;
  if (!all && !ids?.length) return NextResponse.json({ error: "Indica ids oppure all=true" }, { status: 400 });
  const r = await prisma.notification.updateMany({
    where: { userId, letta: null, ...(all ? {} : { id: { in: ids } }) },
    data: { letta: new Date() },
  });
  return NextResponse.json({ ok: true, count: r.count, unread: await prisma.notification.count({ where: { userId, letta: null } }) });
}
