import { SignJWT, jwtVerify } from "jose";
import type { Ruolo } from "@/lib/constants";

export interface SessionPayload {
  sub: string; // user id
  email: string;
  nome: string;
  ruolo: Ruolo;
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
  return new SignJWT({ email: payload.email, nome: payload.nome, ruolo: payload.ruolo })
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
    };
  } catch {
    return null;
  }
}
