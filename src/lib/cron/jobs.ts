import "server-only";
import { prisma } from "@/lib/db";
import { notify, notifyAdmins, notifyMany } from "@/lib/notifications";
import { syncAllGoogleAccounts } from "@/lib/gmail";
import { RUOLI_STAFF, STATI_TASK_APERTI } from "@/lib/constants";
import { addDays, daysUntil, endOfDayLocal, formatDate, startOfDayLocal } from "@/lib/utils";
import { destinatarioPromemoria, livelloPromemoria, orizzontePromemoria, testoPromemoria } from "@/lib/cron/promemoria";

/**
 * Promemoria scadenze: per ogni attività aperta invia al massimo una notifica per "livello"
 * (preavviso, domani, oggi, scaduta). Con giorniPreavviso = 0 (o 1) non c'è preavviso.
 *
 * Il destinatario è l'assegnatario; se manca o non è più attivo l'avviso ricade sul referente del
 * cliente e poi sugli amministratori (destinatarioPromemoria). Il livello viene segnato come inviato
 * SOLO se qualcuno è stato davvero raggiunto: altrimenti si riprova il giorno dopo, invece di
 * consumarlo in silenzio.
 */
export async function jobPromemoriaScadenze() {
  const oggi = startOfDayLocal(new Date());
  const max = await prisma.task.aggregate({ where: { stato: { in: STATI_TASK_APERTI } }, _max: { giorniPreavviso: true } });
  const orizzonte = addDays(oggi, orizzontePromemoria(max._max.giorniPreavviso));
  const persona = { select: { id: true, nome: true, attivo: true } } as const;
  const tasks = await prisma.task.findMany({
    where: { stato: { in: STATI_TASK_APERTI }, scadenza: { lte: endOfDayLocal(orizzonte) } },
    include: {
      assignee: persona,
      client: { select: { denominazione: true, attivo: true, referente: persona } },
    },
  });
  let inviate = 0;
  let senzaDestinatario = 0;
  for (const t of tasks) {
    const diff = daysUntil(t.scadenza);
    const livello = livelloPromemoria(diff, t.giorniPreavviso);
    if (!livello || livello === t.lastReminderKind) continue;

    const destinatario = destinatarioPromemoria({
      assegnatario: t.assignee,
      cliente: t.client ? { attivo: t.client.attivo, referente: t.client.referente } : null,
    });
    if (destinatario.tipo === "NESSUNO") {
      senzaDestinatario++;
      continue;
    }

    const testo = testoPromemoria(livello, diff, t.titolo);
    const cliente = t.client ? ` · ${t.client.denominazione}` : "";
    const avviso = {
      tipo: testo.tipo,
      titolo: destinatario.tipo === "ASSEGNATARIO" ? testo.titolo : `${destinatario.prefisso} · ${testo.titolo}`,
      corpo: `Scadenza ${formatDate(t.scadenza)}${cliente}` + (destinatario.tipo === "ASSEGNATARIO" ? "" : `\n${destinatario.motivo}`),
      link: `/attivita/${t.id}`,
      email: livello !== "PREAVVISO",
    };

    let raggiunti = 0;
    if (destinatario.tipo === "AMMINISTRATORI") {
      raggiunti = await notifyAdmins(avviso);
    } else {
      raggiunti = (await notify({ userId: destinatario.userId, ...avviso })) ? 1 : 0;
      // l'utente può essere stato disattivato fra la lettura e l'invio: si ricade sugli amministratori
      if (!raggiunti) raggiunti = await notifyAdmins(avviso);
    }

    if (!raggiunti) {
      senzaDestinatario++; // il livello non si consuma: domani si riprova
      continue;
    }
    await prisma.task.update({ where: { id: t.id }, data: { lastReminderKind: livello, lastReminderAt: new Date() } });
    inviate++;
  }
  return { controllate: tasks.length, inviate, senzaDestinatario };
}

/**
 * Allerta assenze: se un collaboratore è assente (assenza approvata, in corso o che inizia entro
 * `giorniOrizzonte` giorni) e ha attività aperte in scadenza durante l'assenza, avvisa gli amministratori
 * (o, se non ce ne sono altri, gli altri collaboratori attivi) così che qualcuno possa riassegnarle.
 * La stessa allerta (stesso elenco di attività) non viene ripetuta: si rinotifica solo se l'elenco cambia.
 */
export async function jobAllertaAssenze(giorniOrizzonte = 3) {
  const oggi = startOfDayLocal(new Date());
  const fineOrizzonte = endOfDayLocal(addDays(oggi, giorniOrizzonte));
  const assenze = await prisma.absence.findMany({
    where: { stato: "APPROVATA", dataInizio: { lte: fineOrizzonte }, dataFine: { gte: oggi } },
    include: { user: { select: { id: true, nome: true, attivo: true } } },
  });
  if (!assenze.length) return { assenze: 0, allerte: 0 };

  const staff = await prisma.user.findMany({ where: { ruolo: { in: [...RUOLI_STAFF] }, attivo: true }, select: { id: true, ruolo: true } });
  let allerte = 0;
  for (const a of assenze) {
    if (!a.user.attivo) continue;
    const inizioAssenza = startOfDayLocal(a.dataInizio);
    const finestraFine = endOfDayLocal(a.dataFine < fineOrizzonte ? a.dataFine : fineOrizzonte);
    const tasks = await prisma.task.findMany({
      where: { assigneeId: a.userId, stato: { in: STATI_TASK_APERTI }, scadenza: { gte: inizioAssenza, lte: finestraFine } },
      include: { client: { select: { denominazione: true } } },
      orderBy: { scadenza: "asc" },
      take: 20,
    });
    if (!tasks.length) continue;
    const elenco = tasks
      .slice(0, 5)
      .map((t) => `• ${formatDate(t.scadenza)} ${t.titolo}${t.client ? ` (${t.client.denominazione})` : ""}`)
      .join("\n");
    const resto = tasks.length - 5;
    const extra = resto > 1 ? `\n…e altre ${resto}` : resto === 1 ? "\n…e un'altra" : "";
    let destinatari = staff.filter((x) => x.ruolo === "ADMIN" && x.id !== a.userId).map((x) => x.id);
    if (!destinatari.length) destinatari = staff.filter((x) => x.id !== a.userId).map((x) => x.id);
    if (!destinatari.length) continue;

    const titolo =
      tasks.length === 1
        ? `${a.user.nome} è assente e ha un'attività in scadenza`
        : `${a.user.nome} è assente e ha ${tasks.length} attività in scadenza`;
    const corpo = `Assenza dal ${formatDate(a.dataInizio)} al ${formatDate(a.dataFine)}.\n${elenco}${extra}`;
    const link = `/attivita?assegnatario=${a.userId}&stato=aperte&ordina=scadenza`;

    // Deduplica: se dall'inizio della finestra di allerta è già stata inviata la stessa identica notifica
    // (stesso elenco di attività) a tutti i destinatari, non la ripetiamo.
    const giaInviata = await prisma.notification.findMany({
      where: { userId: { in: destinatari }, tipo: "ALLERTA_ASSENZA", titolo, corpo, link, createdAt: { gte: addDays(inizioAssenza, -giorniOrizzonte) } },
      select: { userId: true },
    });
    const daAvvisare = destinatari.filter((id) => !giaInviata.some((n) => n.userId === id));
    if (!daAvvisare.length) continue;

    await notifyMany(daAvvisare, { tipo: "ALLERTA_ASSENZA", titolo, corpo, link, email: true });
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
