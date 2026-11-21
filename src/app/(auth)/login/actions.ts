"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { apriSessione, richiedeCodice } from "@/lib/auth/accesso";
import { destinazioneDopoAccesso } from "@/lib/auth/redirect";
import { avviaSecondoPasso } from "@/lib/auth/secondo-passo";
import {
  LOGIN_MAX_PER_EMAIL,
  LOGIN_MAX_PER_IP,
  LOGIN_WINDOW_MS,
  checkRateLimit,
  clientIpFromHeaders,
  recordAttempt,
  resetRateLimit,
} from "@/lib/auth/rate-limit";
import { normalizeEmail } from "@/lib/utils";
import { audit } from "@/lib/audit";

export interface LoginState {
  error?: string;
}

function minuti(sec: number) {
  const m = Math.max(1, Math.ceil(sec / 60));
  return m === 1 ? "1 minuto" : `${m} minuti`;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!email || !password) return { error: "Inserisci email e password." };

  // Limite tentativi per email e per IP (protezione da attacchi a forza bruta)
  const ip = clientIpFromHeaders(await headers());
  const keyEmail = `login:email:${email}`;
  const keyIp = `login:ip:${ip}`;
  const limitEmail = checkRateLimit(keyEmail, LOGIN_MAX_PER_EMAIL, LOGIN_WINDOW_MS);
  const limitIp = checkRateLimit(keyIp, LOGIN_MAX_PER_IP, LOGIN_WINDOW_MS);
  if (!limitEmail.ok || !limitIp.ok) {
    const attesa = Math.max(limitEmail.retryAfterSec, limitIp.retryAfterSec);
    await audit({ azione: "LOGIN_BLOCCATO", entita: "User", dettagli: { email, ip } });
    return { error: `Troppi tentativi di accesso. Riprova tra ${minuti(attesa)}.` };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user && user.attivo && (await verifyPassword(password, user.passwordHash));
  if (!ok) {
    recordAttempt(keyEmail, LOGIN_WINDOW_MS);
    recordAttempt(keyIp, LOGIN_WINDOW_MS);
    await audit({ azione: "LOGIN_FALLITO", entita: "User", entitaId: user?.id, dettagli: { email, ip } });
    return { error: "Credenziali non valide." };
  }

  if (richiedeCodice(user)) {
    // password giusta, ma l'accesso non è ancora avvenuto: niente sessione e niente «ultimo accesso»
    // finché non arriva il codice. I tentativi falliti restano contati fino ad accesso completato.
    await avviaSecondoPasso({ sub: user.id, sv: user.sessionVersion, metodo: "password", next });
    await audit({ userId: user.id, azione: "LOGIN_ATTESA_CODICE", entita: "User", entitaId: user.id, dettagli: { metodo: "password", ip } });
    redirect("/login/codice");
  }

  resetRateLimit(keyEmail);
  await apriSessione(user);
  await audit({ userId: user.id, azione: "LOGIN", entita: "User", entitaId: user.id });
  redirect(destinazioneDopoAccesso(next, user.ruolo));
}
