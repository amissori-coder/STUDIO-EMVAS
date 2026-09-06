import "server-only";
import { prisma } from "@/lib/db";
import { notify, notifyMany } from "@/lib/notifications";
import { syncAllGoogleAccounts } from "@/lib/gmail";
import { STATI_TASK_APERTI } from "@/lib/constants";
import { addDays, daysUntil, endOfDayLocal, formatDate, startOfDayLocal } from "@/lib/utils";

/**
 * Promemoria scadenze: per ogni attività aperta assegnata invia al massimo una notifica
 * per "livello" (preavviso, domani, oggi, scaduta).
 */
export async function jobPromemoriaScadenze() {
  const oggi = startOfDayLocal(new Date());
  const orizzonte = addDays(oggi, 60);
  const tasks = await prisma.task.findMany({
    where: { stato: { in: STATI_TASK_APERTI }, assigneeId: { not: null }, scadenza: { lte: endOfDayLocal(orizzonte) } },
    include: { client: { select: { denominazione: true } } },
  });
  let inviate = 0;
  for (const t of tasks) {
    const diff = daysUntil(t.scadenza);
    let kind: "PREAVVISO" | "DOMANI" | "OGGI" | "SCADUTA" | null = null;
    if (diff < 0) kind = "SCADUTA";
    else if (diff === 0) kind = "OGGI";
    else if (diff === 1) kind = "DOMANI";
    else if (diff <= (t.giorniPreavviso || 7)) kind = "PREAVVISO";
    if (!kind || kind === t.lastReminderKind) continue;

    const cliente = t.client ? ` · ${t.client.denominazione}` : "";
    const testo: Record<typeof kind, { tipo: "SCADENZA_VICINA" | "SCADENZA_OGGI" | "SCADUTA"; titolo: string }> = {
      PREAVVISO: { tipo: "SCADENZA_VICINA", titolo: `Scade tra ${diff} giorni: ${t.titolo}` },
      DOMANI: { tipo: "SCADENZA_VICINA", titolo: `Scade domani: ${t.titolo}` },
      OGGI: { tipo: "SCADENZA_OGGI", titolo: `Scade oggi: ${t.titolo}` },
      SCADUTA: { tipo: "SCADUTA", titolo: `Scaduta da ${-diff} giorni: ${t.titolo}` },
    };
    await notify({
      userId: t.assigneeId!,
      tipo: testo[kind].tipo,
      titolo: testo[kind].titolo,
      corpo: `Scadenza ${formatDate(t.scadenza)}${cliente}`,
      link: `/attivita/${t.id}`,
      email: kind !== "PREAVVISO",
    });
    await prisma.task.update({ where: { id: t.id }, data: { lastReminderKind: kind, lastReminderAt: new Date() } });
    inviate++;
  }
  return { controllate: tasks.length, inviate };
}

/**
 * Allerta assenze: se un collaboratore è assente (assenza approvata) e ha attività in scadenza
 * nel periodo di assenza (o già scadute), avvisa gli amministratori e gli altri collaboratori
 * attivi, così che qualcuno possa riassegnarle.
 */
export async function jobAllertaAssenze(giorniOrizzonte = 3) {
  const oggi = startOfDayLocal(new Date());
  const fineOrizzonte = endOfDayLocal(addDays(oggi, giorniOrizzonte));
  const assenze = await prisma.absence.findMany({
    where: { stato: "APPROVATA", dataInizio: { lte: fineOrizzonte }, dataFine: { gte: oggi } },
    include: { user: { select: { id: true, nome: true, attivo: true } } },
  });
  if (!assenze.length) return { assenze: 0, allerte: 0 };

  const admins = await prisma.user.findMany({ where: { ruolo: "ADMIN", attivo: true }, select: { id: true } });
  let allerte = 0;
  for (const a of assenze) {
    if (!a.user.attivo) continue;
    const finestraFine = endOfDayLocal(a.dataFine < fineOrizzonte ? a.dataFine : fineOrizzonte);
    const tasks = await prisma.task.findMany({
      where: { assigneeId: a.userId, stato: { in: STATI_TASK_APERTI }, scadenza: { lte: finestraFine } },
      include: { client: { select: { denominazione: true } } },
      orderBy: { scadenza: "asc" },
      take: 20,
    });
    if (!tasks.length) continue;
    const elenco = tasks
      .slice(0, 5)
      .map((t) => `• ${formatDate(t.scadenza)} ${t.titolo}${t.client ? ` (${t.client.denominazione})` : ""}`)
      .join("\n");
    const extra = tasks.length > 5 ? `\n…e altre ${tasks.length - 5}` : "";
    const destinatari = admins.map((x) => x.id).filter((id) => id !== a.userId);
    await notifyMany(destinatari, {
      tipo: "ALLERTA_ASSENZA",
      titolo: `${a.user.nome} è assente e ha ${tasks.length} attività in scadenza`,
      corpo: `Assenza dal ${formatDate(a.dataInizio)} al ${formatDate(a.dataFine)}.\n${elenco}${extra}`,
      link: `/attivita?assegnatario=${a.userId}&stato=aperte&ordina=scadenza`,
      email: true,
    });
    allerte++;
  }
  return { assenze: assenze.length, allerte };
}

export async function jobSincronizzaGmail() {
  return syncAllGoogleAccounts();
}

/** Esegue tutti i job giornalieri (usato dal cron interno e dall'endpoint /api/cron/daily). */
export async function eseguiJobGiornalieri() {
  const promemoria = await jobPromemoriaScadenze().catch((e) => ({ error: String(e) }));
  const assenze = await jobAllertaAssenze().catch((e) => ({ error: String(e) }));
  return { promemoria, assenze, eseguitoAlle: new Date().toISOString() };
}
