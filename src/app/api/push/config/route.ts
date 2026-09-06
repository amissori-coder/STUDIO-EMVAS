import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { isPushConfigured } from "@/lib/notifications";

/**
 * Chiave pubblica VAPID letta a runtime dal server: così le notifiche push funzionano anche se le chiavi
 * vengono impostate dopo la build (NEXT_PUBLIC_* viene incorporato nel bundle solo al momento della build).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  return NextResponse.json(
    { publicKey: isPushConfigured() ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
