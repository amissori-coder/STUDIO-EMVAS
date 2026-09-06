import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/mailer";
import type { TipoNotifica } from "@/lib/constants";

let vapidReady = false;

export function isPushConfigured() {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function ensureVapid() {
  if (vapidReady) return true;
  if (!isPushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:studio@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  vapidReady = true;
  return true;
}

export function appUrl(path = "/") {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

export interface NotifyInput {
  userId: string;
  tipo: TipoNotifica;
  titolo: string;
  corpo?: string;
  link?: string;
  /** invia anche push (default true) */
  push?: boolean;
  /** invia anche email (default false; rispetta comunque le preferenze utente) */
  email?: boolean;
}

/** Invia una notifica push a tutte le sottoscrizioni di un utente; rimuove quelle scadute. */
export async function sendPushToUser(userId: string, payload: { title: string; body?: string; url?: string; tag?: string }) {
  if (!ensureVapid()) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: payload.title, body: payload.body ?? "", url: appUrl(payload.url ?? "/"), tag: payload.tag }),
        { TTL: 60 * 60 * 24 },
      );
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        console.error("[push] invio fallito:", status, (e as Error).message);
      }
    }
  }
  return sent;
}

/**
 * Crea una notifica in-app e la recapita via push (e opzionalmente email).
 * Non lancia mai: gli errori di consegna vengono solo registrati.
 */
export async function notify(input: NotifyInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, attivo: true, notificaPush: true, notificaEmail: true },
  });
  if (!user || !user.attivo) return null;

  const n = await prisma.notification.create({
    data: {
      userId: input.userId,
      tipo: input.tipo,
      titolo: input.titolo,
      corpo: input.corpo,
      link: input.link,
    },
  });

  const tasks: Promise<unknown>[] = [];
  if (input.push !== false && user.notificaPush) {
    tasks.push(sendPushToUser(user.id, { title: input.titolo, body: input.corpo, url: input.link, tag: n.id }));
  }
  if (input.email && user.notificaEmail) {
    const link = input.link ? `\n\nApri: ${appUrl(input.link)}` : "";
    tasks.push(sendEmail({ to: user.email, subject: `[Studio EMVAS] ${input.titolo}`, text: `${input.corpo ?? ""}${link}` }));
  }
  await Promise.allSettled(tasks);
  return n;
}

export async function notifyMany(userIds: string[], input: Omit<NotifyInput, "userId">) {
  const unique = Array.from(new Set(userIds));
  await Promise.allSettled(unique.map((userId) => notify({ ...input, userId })));
}

/** Notifica tutti gli amministratori attivi (escludendo opzionalmente un utente). */
export async function notifyAdmins(input: Omit<NotifyInput, "userId">, excludeUserId?: string) {
  const admins = await prisma.user.findMany({ where: { ruolo: "ADMIN", attivo: true }, select: { id: true } });
  await notifyMany(admins.map((a) => a.id).filter((id) => id !== excludeUserId), input);
}

export async function countUnreadNotifications(userId: string) {
  return prisma.notification.count({ where: { userId, letta: null } });
}
