import "server-only";
import { prisma } from "@/lib/db";

/** Opzioni per i form attività: clienti attivi (più quello eventualmente già selezionato), staff attivo, catalogo adempimenti. */
export async function caricaOpzioniForm(opts: { includiClienteId?: string | null; includiUtenteId?: string | null } = {}) {
  const [clienti, utenti, templates] = await Promise.all([
    prisma.client.findMany({
      where: { OR: [{ attivo: true }, ...(opts.includiClienteId ? [{ id: opts.includiClienteId }] : [])] },
      select: { id: true, denominazione: true },
      orderBy: { denominazione: "asc" },
    }),
    prisma.user.findMany({
      where: { ruolo: { in: ["ADMIN", "COLLABORATORE"] }, OR: [{ attivo: true }, ...(opts.includiUtenteId ? [{ id: opts.includiUtenteId }] : [])] },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.adempimentoTemplate.findMany({ select: { id: true, nome: true, categoria: true }, orderBy: [{ ordine: "asc" }, { nome: "asc" }] }),
  ]);
  return { clienti, utenti, templates };
}
