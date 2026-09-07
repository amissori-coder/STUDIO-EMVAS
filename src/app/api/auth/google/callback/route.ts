import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { exchangeCodeForTokens, fetchGoogleUserInfo, isGoogleConfigured } from "@/lib/auth/google";
import { createSession } from "@/lib/auth/session";
import { getCurrentUser, isStaff } from "@/lib/auth/guards";
import { isSafeInternalPath } from "@/lib/auth/redirect";
import { normalizeEmail } from "@/lib/utils";
import { audit } from "@/lib/audit";
import type { Ruolo } from "@/lib/constants";

const STATE_COOKIE = "emvas_google_state";
const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

const stateSchema = z.object({
  n: z.string().min(1),
  mode: z.enum(["login", "connect"]),
  next: z.string().optional(),
});

function parseState(raw: string | null): z.infer<typeof stateSchema> | null {
  if (!raw) return null;
  try {
    const parsed = stateSchema.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const fail = (code: string, mode: "login" | "connect" = "login") => {
    const res = NextResponse.redirect(new URL(mode === "connect" ? `/impostazioni?errore=${code}` : `/login?errore=${code}`, request.url));
    res.cookies.delete(STATE_COOKIE);
    return res;
  };

  if (!isGoogleConfigured()) return fail("google-non-configurato");
  if (url.searchParams.get("error")) return fail("google-negato");

  const state = parseState(url.searchParams.get("state"));
  if (!state) return fail("google-stato");
  const nonce = request.cookies.get(STATE_COOKIE)?.value;
  if (!nonce || nonce !== state.n) return fail("google-stato", state.mode);

  const code = url.searchParams.get("code");
  if (!code) return fail("google-errore", state.mode);

  try {
    const tokens = await exchangeCodeForTokens(code);
    const info = await fetchGoogleUserInfo(tokens.access_token);
    const googleEmail = normalizeEmail(info.email);
    const allowedDomain = process.env.GOOGLE_ALLOWED_DOMAIN?.toLowerCase();
    if (allowedDomain && !googleEmail.endsWith(`@${allowedDomain}`)) return fail("google-dominio", state.mode);

    let user;
    let sessionVersion = 0;
    if (state.mode === "connect") {
      user = await getCurrentUser();
      if (!user || !isStaff(user)) return fail("google-utente", "connect");
    } else {
      const found = await prisma.user.findUnique({ where: { email: googleEmail } });
      if (!found || !found.attivo || !["ADMIN", "COLLABORATORE"].includes(found.ruolo)) return fail("google-utente");
      user = { id: found.id, email: found.email, nome: found.nome, ruolo: found.ruolo as Ruolo };
      sessionVersion = found.sessionVersion;
    }

    // Il permesso Gmail può essere deselezionato nella schermata di consenso: senza quello scope
    // la casella non va collegata (ogni sync fallirebbe con 403).
    const hasGmailScope = (tokens.scope ?? "").split(/\s+/).includes(GMAIL_READONLY_SCOPE);
    // La stessa casella non può essere collegata da due utenti diversi (email duplicate e notifiche doppie).
    const altroUtente = await prisma.googleAccount.findFirst({
      where: { googleEmail, userId: { not: user.id } },
      select: { id: true },
    });
    if (state.mode === "connect") {
      if (!hasGmailScope) return fail("google-scope", "connect");
      if (altroUtente) return fail("google-casella-usata", "connect");
    }

    if (hasGmailScope && !altroUtente) {
      // Salva/aggiorna i token per l'accesso a Gmail (il refresh token arriva solo con prompt=consent)
      const existing = await prisma.googleAccount.findUnique({ where: { userId: user.id } });
      await prisma.googleAccount.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          googleEmail,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? null,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          scope: tokens.scope,
        },
        update: {
          googleEmail,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? existing?.refreshToken ?? null,
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          scope: tokens.scope,
          syncError: null,
          // se cambia la casella, riparte la sincronizzazione completa
          ...(existing && existing.googleEmail !== googleEmail ? { historyId: null } : {}),
        },
      });
    }

    if (state.mode === "login") {
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      await createSession({ sub: user.id, email: user.email, nome: user.nome, ruolo: user.ruolo, sv: sessionVersion });
      await audit({ userId: user.id, azione: "LOGIN_GOOGLE", entita: "User", entitaId: user.id });
    } else {
      await audit({ userId: user.id, azione: "GMAIL_COLLEGATO", entita: "GoogleAccount", entitaId: user.id, dettagli: { googleEmail } });
    }

    const next = isSafeInternalPath(state.next) && !state.next.startsWith("/portale") ? state.next : null;
    const dest = state.mode === "connect" ? "/impostazioni?messaggio=gmail-collegato" : (next ?? "/dashboard");
    const res = NextResponse.redirect(new URL(dest, request.url));
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (e) {
    console.error("[google callback]", e);
    return fail("google-errore", state.mode);
  }
}
