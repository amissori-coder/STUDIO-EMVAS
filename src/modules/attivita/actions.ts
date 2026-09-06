"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { AuthError, isAdmin, requireStaffAction } from "@/lib/auth/guards";
import { PRIORITA_TASK, STATI_TASK, type StatoTask } from "@/lib/constants";
import { formatDate, parseDateInput } from "@/lib/utils";
import { anteprimaPianificazione, pianificaAnno } from "@/lib/adempimenti/engine";
import { serializzaAnteprima, type AnteprimaRiga } from "@/modules/attivita/pianificazione";

export interface ActionResult {
  ok?: boolean;
  error?: string;
}

const PRIORITA_KEYS = Object.keys(PRIORITA_TASK) as [string, ...string[]];
const STATO_KEYS = Object.keys(STATI_TASK) as [string, ...string[]];

const taskSchema = z.object({
  titolo: z.string().trim().min(1, "Inserisci un titolo.").max(200, "Titolo troppo lungo (max 200 caratteri)."),
  descrizione: z.string().trim().max(5000, "Descrizione troppo lunga.").optional(),
  clientId: z.string().trim().optional(),
  scadenza: z.string().trim().min(1, "Inserisci la scadenza."),
  priorita: z.enum(PRIORITA_KEYS, { error: "Priorità non valida." }),
  assigneeId: z.string().trim().optional(),
  giorniPreavviso: z.coerce.number().int().min(0, "Preavviso non valido.").max(365, "Preavviso non valido."),
  templateId: z.string().trim().optional(),
});

function fd(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function primoErrore(e: z.ZodError) {
  return e.issues[0]?.message ?? "Dati non validi.";
}

function erroreUtente(e: unknown): ActionResult {
  if (e instanceof AuthError) return { error: e.message };
  console.error("[attivita] errore action:", e);
  return { error: "Si è verificato un errore imprevisto. Riprova." };
}

/** Invalida tutte le pagine che mostrano attività. */
function revalidateTask(task: { id: string; clientId: string | null }) {
  revalidatePath("/attivita");
  revalidatePath(`/attivita/${task.id}`);
  revalidatePath("/scadenzario");
  revalidatePath("/dashboard");
  if (task.clientId) {
    revalidatePath(`/clienti/${task.clientId}`);
    revalidatePath(`/attivita/cliente/${task.clientId}`);
  }
}

async function validaRiferimenti(input: { clientId?: string; assigneeId?: string; templateId?: string }) {
  const clientId = input.clientId || null;
  const assigneeId = input.assigneeId || null;
  const templateId = input.templateId || null;
  if (clientId) {
    const c = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!c) return { error: "Cliente non trovato." } as const;
  }
  if (assigneeId) {
    const u = await prisma.user.findUnique({ where: { id: assigneeId }, select: { id: true, ruolo: true, attivo: true } });
    if (!u || !u.attivo || u.ruolo === "CLIENTE") return { error: "Assegnatario non valido." } as const;
  }
  if (templateId) {
    const t = await prisma.adempimentoTemplate.findUnique({ where: { id: templateId }, select: { id: true } });
    if (!t) return { error: "Adempimento non trovato." } as const;
  }
  return { clientId, assigneeId, templateId } as const;
}

async function notificaAssegnazione(task: { id: string; titolo: string; scadenza: Date; assigneeId: string | null }, attoreId: string, clienteNome?: string | null, nuova = true) {
  if (!task.assigneeId || task.assigneeId === attoreId) return;
  await notify({
    userId: task.assigneeId,
    tipo: "ATTIVITA_ASSEGNATA",
    titolo: `${nuova ? "Nuova attività assegnata" : "Attività assegnata a te"}: ${task.titolo}`,
    corpo: `Scadenza ${formatDate(task.scadenza)}${clienteNome ? ` · ${clienteNome}` : ""}`,
    link: `/attivita/${task.id}`,
  });
}

// ---------------------------------------------------------------------------
// Creazione / modifica
// ---------------------------------------------------------------------------

export async function creaTask(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  let nuovoId: string;
  try {
    const user = await requireStaffAction();
    const parsed = taskSchema.safeParse({
      titolo: fd(formData, "titolo"),
      descrizione: fd(formData, "descrizione"),
      clientId: fd(formData, "clientId"),
      scadenza: fd(formData, "scadenza"),
      priorita: fd(formData, "priorita") || "MEDIA",
      assigneeId: fd(formData, "assigneeId"),
      giorniPreavviso: fd(formData, "giorniPreavviso") || "7",
      templateId: fd(formData, "templateId"),
    });
    if (!parsed.success) return { error: primoErrore(parsed.error) };
    const scadenza = parseDateInput(parsed.data.scadenza);
    if (!scadenza) return { error: "Data di scadenza non valida." };
    const rif = await validaRiferimenti(parsed.data);
    if ("error" in rif) return { error: rif.error };

    const task = await prisma.task.create({
      data: {
        titolo: parsed.data.titolo,
        descrizione: parsed.data.descrizione || null,
        clientId: rif.clientId,
        templateId: rif.templateId,
        scadenza,
        priorita: parsed.data.priorita,
        assigneeId: rif.assigneeId,
        createdById: user.id,
        giorniPreavviso: parsed.data.giorniPreavviso,
        anno: scadenza.getFullYear(),
      },
      include: { client: { select: { denominazione: true } } },
    });
    await audit({ userId: user.id, azione: "TASK_CREATA", entita: "Task", entitaId: task.id, dettagli: { titolo: task.titolo, clientId: task.clientId, assigneeId: task.assigneeId, scadenza: task.scadenza } });
    await notificaAssegnazione(task, user.id, task.client?.denominazione);
    revalidateTask(task);
    nuovoId = task.id;
  } catch (e) {
    return erroreUtente(e);
  }
  redirect(`/attivita/${nuovoId}`);
}

export async function aggiornaTask(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireStaffAction();
    const id = fd(formData, "id");
    const esistente = await prisma.task.findUnique({ where: { id }, include: { client: { select: { denominazione: true } } } });
    if (!esistente) return { error: "Attività non trovata." };
    const parsed = taskSchema.safeParse({
      titolo: fd(formData, "titolo"),
      descrizione: fd(formData, "descrizione"),
      clientId: fd(formData, "clientId"),
      scadenza: fd(formData, "scadenza"),
      priorita: fd(formData, "priorita") || "MEDIA",
      assigneeId: fd(formData, "assigneeId"),
      giorniPreavviso: fd(formData, "giorniPreavviso") || "7",
      templateId: fd(formData, "templateId"),
    });
    if (!parsed.success) return { error: primoErrore(parsed.error) };
    const scadenza = parseDateInput(parsed.data.scadenza);
    if (!scadenza) return { error: "Data di scadenza non valida." };
    const rif = await validaRiferimenti(parsed.data);
    if ("error" in rif) return { error: rif.error };

    const task = await prisma.task.update({
      where: { id },
      data: {
        titolo: parsed.data.titolo,
        descrizione: parsed.data.descrizione || null,
        clientId: rif.clientId,
        templateId: rif.templateId,
        scadenza,
        priorita: parsed.data.priorita,
        assigneeId: rif.assigneeId,
        giorniPreavviso: parsed.data.giorniPreavviso,
        // se la scadenza cambia anno e l'attività è manuale, aggiorna l'anno di riferimento
        anno: esistente.chiave ? esistente.anno : scadenza.getFullYear(),
        // se cambia la scadenza o l'assegnatario, i promemoria ripartono da zero (come in riassegnaTask)
        ...(scadenza.getTime() !== esistente.scadenza.getTime() || rif.assigneeId !== esistente.assigneeId ? { lastReminderKind: null, lastReminderAt: null } : {}),
      },
      include: { client: { select: { denominazione: true } } },
    });
    await audit({ userId: user.id, azione: "TASK_MODIFICATA", entita: "Task", entitaId: task.id, dettagli: { prima: { titolo: esistente.titolo, scadenza: esistente.scadenza, assigneeId: esistente.assigneeId, priorita: esistente.priorita }, dopo: { titolo: task.titolo, scadenza: task.scadenza, assigneeId: task.assigneeId, priorita: task.priorita } } });
    if (task.assigneeId !== esistente.assigneeId) await notificaAssegnazione(task, user.id, task.client?.denominazione, false);
    revalidateTask(task);
    if (esistente.clientId && esistente.clientId !== task.clientId) revalidatePath(`/clienti/${esistente.clientId}`);
    return { ok: true };
  } catch (e) {
    return erroreUtente(e);
  }
}

// ---------------------------------------------------------------------------
// Stato, assegnazione, note
// ---------------------------------------------------------------------------

async function cambiaStatoInterno(id: string, stato: StatoTask, opts: { prendiInCarico?: boolean } = {}) {
  const user = await requireStaffAction();
  const esistente = await prisma.task.findUnique({ where: { id }, select: { id: true, stato: true, clientId: true, assigneeId: true } });
  if (!esistente) throw new AuthError("Attività non trovata.", 404);
  const chiusa = stato === "COMPLETATA" || stato === "ANNULLATA";
  const task = await prisma.task.update({
    where: { id },
    data: {
      stato,
      completatoAt: stato === "COMPLETATA" ? new Date() : null,
      ...(opts.prendiInCarico ? { assigneeId: user.id } : {}),
      ...(chiusa ? {} : { lastReminderKind: null, lastReminderAt: null }),
    },
  });
  await audit({ userId: user.id, azione: "TASK_STATO", entita: "Task", entitaId: id, dettagli: { da: esistente.stato, a: stato, prendiInCarico: !!opts.prendiInCarico } });
  revalidateTask(task);
  return task;
}

/** Cambio stato dal dettaglio (useActionState). */
export async function cambiaStato(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const id = fd(formData, "id");
    const stato = fd(formData, "stato");
    if (!STATO_KEYS.includes(stato)) return { error: "Stato non valido." };
    await cambiaStatoInterno(id, stato as StatoTask);
    return { ok: true };
  } catch (e) {
    return erroreUtente(e);
  }
}

/** Azione rapida: completa (form inline). */
export async function completaTaskRapida(formData: FormData) {
  await cambiaStatoInterno(fd(formData, "id"), "COMPLETATA");
}

/** Azione rapida: prendi in carico (assegna a me + IN_CORSO). */
export async function prendiInCaricoRapida(formData: FormData) {
  await cambiaStatoInterno(fd(formData, "id"), "IN_CORSO", { prendiInCarico: true });
}

/** Azione rapida: riapri (torna DA_FARE). */
export async function riapriTaskRapida(formData: FormData) {
  await cambiaStatoInterno(fd(formData, "id"), "DA_FARE");
}

export async function riassegnaTask(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireStaffAction();
    const id = fd(formData, "id");
    const assigneeId = fd(formData, "assigneeId") || null;
    const esistente = await prisma.task.findUnique({ where: { id }, include: { client: { select: { denominazione: true } } } });
    if (!esistente) return { error: "Attività non trovata." };
    const rif = await validaRiferimenti({ assigneeId: assigneeId ?? "" });
    if ("error" in rif) return { error: rif.error };
    if (esistente.assigneeId === assigneeId) return { ok: true };
    const task = await prisma.task.update({ where: { id }, data: { assigneeId, lastReminderKind: null, lastReminderAt: null } });
    await audit({ userId: user.id, azione: "TASK_RIASSEGNATA", entita: "Task", entitaId: id, dettagli: { da: esistente.assigneeId, a: assigneeId } });
    await notificaAssegnazione(task, user.id, esistente.client?.denominazione, false);
    revalidateTask(task);
    return { ok: true };
  } catch (e) {
    return erroreUtente(e);
  }
}

export async function salvaNote(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireStaffAction();
    const id = fd(formData, "id");
    const note = fd(formData, "note").trim().slice(0, 10000);
    const esistente = await prisma.task.findUnique({ where: { id }, select: { id: true } });
    if (!esistente) return { error: "Attività non trovata." };
    const task = await prisma.task.update({ where: { id }, data: { note: note || null } });
    await audit({ userId: user.id, azione: "TASK_NOTE", entita: "Task", entitaId: id });
    revalidateTask(task);
    return { ok: true };
  } catch (e) {
    return erroreUtente(e);
  }
}

export async function eliminaTask(formData: FormData) {
  const user = await requireStaffAction();
  const id = fd(formData, "id");
  const task = await prisma.task.findUnique({ where: { id }, select: { id: true, titolo: true, clientId: true, createdById: true } });
  if (!task) throw new AuthError("Attività non trovata.", 404);
  if (!isAdmin(user) && task.createdById !== user.id) throw new AuthError("Solo un amministratore o chi ha creato l'attività può eliminarla.", 403);
  await prisma.task.delete({ where: { id } });
  await audit({ userId: user.id, azione: "TASK_ELIMINATA", entita: "Task", entitaId: id, dettagli: { titolo: task.titolo, clientId: task.clientId } });
  revalidateTask(task);
  redirect(task.clientId ? `/clienti/${task.clientId}?tab=attivita` : "/attivita");
}

// ---------------------------------------------------------------------------
// Pianificazione adempimenti per cliente (scheda cliente, tab Attività)
// ---------------------------------------------------------------------------

export interface PianificazioneResult extends ActionResult {
  anno?: number;
  righe?: AnteprimaRiga[];
  creati?: number;
  esistenti?: number;
}

const annoSchema = z.coerce.number().int().min(2000).max(2100);

export async function anteprimaCliente(clientId: string, anno: number): Promise<PianificazioneResult> {
  try {
    await requireStaffAction();
    const a = annoSchema.safeParse(anno);
    if (!a.success) return { error: "Anno non valido." };
    const righe = serializzaAnteprima(await anteprimaPianificazione(clientId, a.data));
    return { ok: true, anno: a.data, righe };
  } catch (e) {
    return erroreUtente(e);
  }
}

export async function impostaOverride(clientId: string, templateId: string, valore: "auto" | "attiva" | "disattiva", anno: number): Promise<PianificazioneResult> {
  try {
    const user = await requireStaffAction();
    const a = annoSchema.safeParse(anno);
    if (!a.success) return { error: "Anno non valido." };
    const [client, template] = await Promise.all([
      prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }),
      prisma.adempimentoTemplate.findUnique({ where: { id: templateId }, select: { id: true, nome: true } }),
    ]);
    if (!client || !template) return { error: "Cliente o adempimento non trovato." };
    if (valore === "auto") {
      await prisma.clientAdempimentoOverride.deleteMany({ where: { clientId, templateId } });
    } else {
      await prisma.clientAdempimentoOverride.upsert({
        where: { clientId_templateId: { clientId, templateId } },
        create: { clientId, templateId, attivo: valore === "attiva" },
        update: { attivo: valore === "attiva" },
      });
    }
    await audit({ userId: user.id, azione: "OVERRIDE_ADEMPIMENTO", entita: "Client", entitaId: clientId, dettagli: { templateId, template: template.nome, valore } });
    revalidatePath(`/clienti/${clientId}`);
    revalidatePath(`/attivita/cliente/${clientId}`);
    const righe = serializzaAnteprima(await anteprimaPianificazione(clientId, a.data));
    return { ok: true, anno: a.data, righe };
  } catch (e) {
    return erroreUtente(e);
  }
}

export async function pianificaCliente(clientId: string, anno: number, saltaPassate: boolean): Promise<PianificazioneResult> {
  try {
    const user = await requireStaffAction();
    const a = annoSchema.safeParse(anno);
    if (!a.success) return { error: "Anno non valido." };
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, denominazione: true, referenteId: true } });
    if (!client) return { error: "Cliente non trovato." };
    const esito = await pianificaAnno({ clientId, anno: a.data, createdById: user.id, saltaPassate });
    await audit({ userId: user.id, azione: "PIANIFICAZIONE", entita: "Client", entitaId: clientId, dettagli: { anno: a.data, saltaPassate, ...esito } });
    if (esito.creati > 0 && client.referenteId && client.referenteId !== user.id) {
      await notify({
        userId: client.referenteId,
        tipo: "ATTIVITA_ASSEGNATA",
        titolo: `${esito.creati} nuove attività assegnate: ${client.denominazione} (${a.data})`,
        corpo: `${user.nome} ha pianificato gli adempimenti ${a.data} del cliente.`,
        link: `/attivita?assegnatario=${client.referenteId}&cliente=${clientId}&stato=aperte&ordina=scadenza`,
      });
    }
    revalidatePath("/attivita");
    revalidatePath("/scadenzario");
    revalidatePath("/dashboard");
    revalidatePath("/adempimenti");
    revalidatePath(`/clienti/${clientId}`);
    revalidatePath(`/attivita/cliente/${clientId}`);
    const righe = serializzaAnteprima(await anteprimaPianificazione(clientId, a.data));
    return { ok: true, anno: a.data, righe, creati: esito.creati, esistenti: esito.esistenti };
  } catch (e) {
    return erroreUtente(e);
  }
}
