import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Autorizzazione degli endpoint /api/cron/*:
 *  - header "Authorization: Bearer CRON_SECRET" (confronto a tempo costante; mai nella query string,
 *    che finirebbe nei log del proxy e nella cronologia del browser);
 *  - oppure sessione amministratore, ma solo su POST (un GET con cookie SameSite=Lax potrebbe essere
 *    indotto da un link esterno). L'esecuzione manuale viene registrata in audit.
 */
export async function authorizeCron(request: NextRequest, job: string): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth.startsWith("Bearer ") && safeEqual(auth.slice(7).trim(), secret)) return true;
  }
  if (request.method !== "POST") return false;
  const user = await getCurrentUser();
  if (!isAdmin(user)) return false;
  await audit({ userId: user!.id, azione: "CRON_MANUALE", entita: "Cron", entitaId: job });
  return true;
}
