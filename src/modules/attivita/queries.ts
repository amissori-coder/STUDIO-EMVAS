import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PRIORITA_TASK } from "@/lib/constants";
import { PAGE_SIZE, TASK_LIST_INCLUDE, type Ordinamento, type TaskListItem } from "@/modules/attivita/lib";

interface Partizione {
  where: Prisma.TaskWhereInput;
  orderBy: Prisma.TaskOrderByWithRelationInput[];
}

const PER_SCADENZA: Prisma.TaskOrderByWithRelationInput[] = [{ scadenza: "asc" }, { id: "asc" }];

/**
 * L'ordinamento "priorità" (ALTA → MEDIA → BASSA) e "cliente" (attività interne in coda) non sono
 * esprimibili con un singolo orderBy SQL: l'elenco viene quindi letto come sequenza di partizioni
 * ordinate, ciascuna paginabile con skip/take, così la paginazione avviene interamente sul DB.
 */
function partizioni(where: Prisma.TaskWhereInput, ordina: Ordinamento): Partizione[] {
  if (ordina === "priorita") {
    const ordine: (keyof typeof PRIORITA_TASK)[] = ["ALTA", "MEDIA", "BASSA"];
    return [
      ...ordine.map((p) => ({ where: { AND: [where, { priorita: p }] }, orderBy: PER_SCADENZA })),
      { where: { AND: [where, { priorita: { notIn: ordine } }] }, orderBy: PER_SCADENZA },
    ];
  }
  if (ordina === "cliente") {
    return [
      { where: { AND: [where, { clientId: { not: null } }] }, orderBy: [{ client: { denominazione: "asc" } }, ...PER_SCADENZA] },
      { where: { AND: [where, { clientId: null }] }, orderBy: PER_SCADENZA },
    ];
  }
  return [{ where, orderBy: PER_SCADENZA }];
}

/** Carica una pagina di attività ordinata e paginata lato DB; restituisce anche il totale e la pagina effettiva. */
export async function caricaPaginaTasks(where: Prisma.TaskWhereInput, ordina: Ordinamento, paginaRichiesta: number) {
  const parti = partizioni(where, ordina);
  const conteggi = await Promise.all(parti.map((p) => prisma.task.count({ where: p.where })));
  const totale = conteggi.reduce((s, n) => s + n, 0);
  const pagine = Math.max(1, Math.ceil(totale / PAGE_SIZE));
  const pagina = Math.min(Math.max(1, paginaRichiesta), pagine);

  const tasks: TaskListItem[] = [];
  let offset = (pagina - 1) * PAGE_SIZE;
  let restanti = PAGE_SIZE;
  for (let i = 0; i < parti.length && restanti > 0; i++) {
    const n = conteggi[i]!;
    if (offset >= n) {
      offset -= n;
      continue;
    }
    const chunk = await prisma.task.findMany({ where: parti[i]!.where, include: TASK_LIST_INCLUDE, orderBy: parti[i]!.orderBy, skip: offset, take: restanti });
    tasks.push(...chunk);
    restanti -= chunk.length;
    offset = 0;
  }
  return { tasks, totale, pagine, pagina };
}
