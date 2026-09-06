"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/utils";
import { audit } from "@/lib/audit";
import type { Ruolo } from "@/lib/constants";

export interface LoginState {
  error?: string;
}

function safeNext(next: string | null | undefined, ruolo: Ruolo) {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    if (ruolo === "CLIENTE" && !next.startsWith("/portale")) return "/portale";
    if (ruolo !== "CLIENTE" && next.startsWith("/portale")) return "/dashboard";
    return next;
  }
  return ruolo === "CLIENTE" ? "/portale" : "/dashboard";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!email || !password) return { error: "Inserisci email e password." };

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user && user.attivo && (await verifyPassword(password, user.passwordHash));
  if (!ok) {
    await audit({ azione: "LOGIN_FALLITO", entita: "User", entitaId: user?.id, dettagli: { email } });
    return { error: "Credenziali non valide." };
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession({ sub: user.id, email: user.email, nome: user.nome, ruolo: user.ruolo as Ruolo });
  await audit({ userId: user.id, azione: "LOGIN", entita: "User", entitaId: user.id });
  redirect(safeNext(next, user.ruolo as Ruolo));
}
