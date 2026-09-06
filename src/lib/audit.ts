import "server-only";
import { prisma } from "@/lib/db";

export async function audit(opts: { userId?: string | null; azione: string; entita: string; entitaId?: string | null; dettagli?: unknown }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: opts.userId ?? null,
        azione: opts.azione,
        entita: opts.entita,
        entitaId: opts.entitaId ?? null,
        dettagli: opts.dettagli === undefined ? null : JSON.stringify(opts.dettagli).slice(0, 4000),
      },
    });
  } catch (e) {
    console.error("[audit] errore:", e);
  }
}
