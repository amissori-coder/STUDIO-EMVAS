import { SignJWT, jwtVerify } from "jose";
import type { Ruolo } from "@/lib/constants";

export interface SessionPayload {
  sub: string; // user id
  email: string;
  nome: string;
  ruolo: Ruolo;
}

export const SESSION_DAYS = 30;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET mancante o troppo corto (min 16 caratteri)");
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
