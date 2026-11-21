import { SignJWT, jwtVerify } from "jose";
import type { Ruolo } from "@/lib/constants";

export interface SessionPayload {
  sub: string; // user id
  email: string;
  nome: string;
  ruolo: Ruolo;
  /** versione della sessione (User.sessionVersion): se cambia, il token non è più valido */
  sv?: number;
}

export const SESSION_DAYS = 30;

/** Valori noti (segnaposto di .env.example / documentazione) che non devono mai essere usati come segreto. */
const SEGRETI_SEGNAPOSTO = new Set(["cambia-questo-segreto-lungo-e-casuale", "dev-only-insecure-secret-0123456789", "changeme", "secret"]);
const LUNGHEZZA_MINIMA = 32;

function getSecret() {
  const secret = process.env.SESSION_SECRET?.trim();
  const valido = !!secret && secret.length >= LUNGHEZZA_MINIMA && !SEGRETI_SEGNAPOSTO.has(secret.toLowerCase());
  if (!valido) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`SESSION_SECRET mancante, troppo corto (min ${LUNGHEZZA_MINIMA} caratteri) o uguale al valore di esempio: genera un segreto con "openssl rand -base64 32"`);
    }
    return new TextEncoder().encode("dev-only-insecure-secret-0123456789");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ email: payload.email, nome: payload.nome, ruolo: payload.ruolo, sv: payload.sv ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: String(payload.email ?? ""),
      nome: String(payload.nome ?? ""),
      ruolo: payload.ruolo as Ruolo,
      sv: typeof payload.sv === "number" ? payload.sv : 0,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------------
// Secondo passo dell'accesso: dopo la password (o Google) e prima del codice a tempo. NON è una sessione:
// è firmato con una chiave diversa, quindi verifySessionToken lo rifiuta e non apre nessuna pagina.

export const SECONDO_PASSO_MINUTI = 10;

export interface SecondoPasso {
  sub: string;
  /** versione della sessione al momento della password: se cambia (reset, azzeramento), si ricomincia */
  sv: number;
  metodo: "password" | "google" | "invito";
  next: string;
}

function chiaveSecondoPasso() {
  const base = getSecret();
  const suffisso = new TextEncoder().encode("|secondo-passo");
  const k = new Uint8Array(base.length + suffisso.length);
  k.set(base);
  k.set(suffisso, base.length);
  return k;
}

export async function firmaSecondoPasso(p: SecondoPasso) {
  return new SignJWT({ sv: p.sv, metodo: p.metodo, next: p.next, scopo: "secondo-passo" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime(`${SECONDO_PASSO_MINUTI}m`)
    .sign(chiaveSecondoPasso());
}

export async function leggiSecondoPassoToken(token: string | undefined | null): Promise<SecondoPasso | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chiaveSecondoPasso());
    if (!payload.sub || payload.scopo !== "secondo-passo") return null;
    const metodo = payload.metodo === "google" || payload.metodo === "invito" ? payload.metodo : "password";
    return { sub: payload.sub, sv: typeof payload.sv === "number" ? payload.sv : 0, metodo, next: typeof payload.next === "string" ? payload.next : "" };
  } catch {
    return null;
  }
}
