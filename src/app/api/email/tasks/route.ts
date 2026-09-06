import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuthError, requireStaffAction } from "@/lib/auth/guards";
import { STATI_TASK_APERTI } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

/** Attività aperte di un cliente (per il select di associazione email). */
export async function GET(request: NextRequest) {
  try {
    await requireStaffAction();
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 401;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
  const parsed = z.string().min(1).safeParse(request.nextUrl.searchParams.get("cliente"));
  if (!parsed.success) return NextResponse.json({ tasks: [] });
  const tasks = await prisma.task.findMany({
    where: { clientId: parsed.data, stato: { in: STATI_TASK_APERTI } },
    select: { id: true, titolo: true, scadenza: true, stato: true },
    orderBy: { scadenza: "asc" },
    take: 200,
  });
  return NextResponse.json({
    tasks: tasks.map((t) => ({ id: t.id, titolo: t.titolo, stato: t.stato, scadenzaLabel: formatDate(t.scadenza) })),
  });
}
