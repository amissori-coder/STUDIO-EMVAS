"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { isSafeInternalPath } from "@/lib/auth/redirect";
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
import type { Ruolo } from "@/lib/constants";

export interface LoginState {
  error?: string;
}

function safeNext(next: string | null | undefined, ruolo: Ruolo) {
  if (isSafeInternalPath(next)) {
    if (ruolo === "CLIENTE" && !next.startsWith("/portale")) return "/portale";
    if (ruolo !== "CLIENTE" && next.startsWith("/portale")) return "/dashboard";
    return next;
  }
  return ruolo === "CLIENTE" ? "/portale" : "/dashboard";
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

  resetRateLimit(keyEmail);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession({ sub: user.id, email: user.email, nome: user.nome, ruolo: user.ruolo as Ruolo });
  await audit({ userId: user.id, azione: "LOGIN", entita: "User", entitaId: user.id });
  redirect(safeNext(next, user.ruolo as Ruolo));
}
