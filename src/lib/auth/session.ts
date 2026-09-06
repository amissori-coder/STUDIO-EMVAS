import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/constants";
import { signSession, verifySessionToken, SESSION_DAYS, type SessionPayload } from "@/lib/auth/jwt";

export type { SessionPayload };
export { verifySessionToken };

export async function createSession(payload: SessionPayload) {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && (process.env.APP_URL ?? "").startsWith("https"),
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Sessione corrente (dal cookie). Non interroga il DB. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}
