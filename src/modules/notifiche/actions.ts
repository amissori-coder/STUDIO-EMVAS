"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuthError, requireUserAction } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";

export interface NotificheState {
  error?: string;
  ok?: boolean;
  /** numero di elementi interessati dall'operazione */
  count?: number;
}

function errorMessage(e: unknown, fallback: string) {
  if (e instanceof AuthError) return e.message;
  console.error(e);
  return fallback;
}

function revalidateNotifiche() {
  revalidatePath("/notifiche");
  revalidatePath("/dashboard");
}

/** Segna come letta una notifica dell'utente corrente. */
export async function markNotificationReadAction(id: string): Promise<NotificheState> {
  try {
    const user = await requireUserAction();
    const nid = z.string().min(1).parse(id);
    const r = await prisma.notification.updateMany({ where: { id: nid, userId: user.id, letta: null }, data: { letta: new Date() } });
    revalidateNotifiche();
    return { ok: true, count: r.count };
  } catch (e) {
    return { error: errorMessage(e, "Errore durante l'aggiornamento della notifica.") };
  }
}

/** Segna come lette tutte le notifiche non lette dell'utente corrente. */
export async function markAllNotificationsReadAction(): Promise<NotificheState> {
  try {
    const user = await requireUserAction();
    const r = await prisma.notification.updateMany({ where: { userId: user.id, letta: null }, data: { letta: new Date() } });
    revalidateNotifiche();
    return { ok: true, count: r.count };
  } catch (e) {
    return { error: errorMessage(e, "Errore durante l'aggiornamento delle notifiche.") };
  }
}

/** Elimina le notifiche già lette più vecchie di 30 giorni. */
export async function deleteOldReadNotificationsAction(): Promise<NotificheState> {
  try {
    const user = await requireUserAction();
    const limite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const r = await prisma.notification.deleteMany({ where: { userId: user.id, letta: { not: null }, createdAt: { lt: limite } } });
    if (r.count > 0) await audit({ userId: user.id, azione: "NOTIFICHE_PULITE", entita: "Notification", dettagli: { eliminate: r.count } });
    revalidateNotifiche();
    return { ok: true, count: r.count };
  } catch (e) {
    return { error: errorMessage(e, "Errore durante la pulizia delle notifiche.") };
  }
}

// ---- Varianti per <form action>: ignorano il risultato (la pagina viene rigenerata) ----
export async function markNotificationReadFormAction(formData: FormData): Promise<void> {
  await markNotificationReadAction(String(formData.get("id") ?? ""));
}

export async function markAllNotificationsReadFormAction(): Promise<void> {
  await markAllNotificationsReadAction();
}

export async function deleteOldReadNotificationsFormAction(): Promise<void> {
  const r = await deleteOldReadNotificationsAction();
  redirect(r.error ? "/notifiche?errore=pulizia" : `/notifiche?messaggio=pulite&n=${r.count ?? 0}`);
}
