import { NextResponse, type NextRequest } from "next/server";
import { syncAllGoogleAccounts } from "@/lib/gmail";
import { authorizeCron } from "@/lib/cron/auth";

/**
 * Sincronizza tutte le caselle Gmail collegate.
 * Autorizzazione: header "Authorization: Bearer CRON_SECRET" (GET o POST) oppure sessione amministratore (solo POST).
 */
async function handler(request: NextRequest) {
  if (!(await authorizeCron(request, "gmail"))) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  return NextResponse.json(await syncAllGoogleAccounts());
}

export const GET = handler;
export const POST = handler;
