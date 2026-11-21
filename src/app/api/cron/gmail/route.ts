import { NextResponse, type NextRequest } from "next/server";
import { postaRegistrata } from "@/lib/cron/jobs";
import { authorizeCron } from "@/lib/cron/auth";

/**
 * Sincronizza tutte le caselle Gmail collegate.
 * Autorizzazione: header "Authorization: Bearer CRON_SECRET" (GET o POST) oppure sessione amministratore (solo POST).
 */
async function handler(request: NextRequest) {
  if (!(await authorizeCron(request, "gmail"))) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const r = await postaRegistrata("HTTP");
  if (!r.eseguito) return NextResponse.json({ error: r.motivo }, { status: 409 });
  return NextResponse.json({ esito: r.esito, caselle: r.risultato });
}

export const GET = handler;
export const POST = handler;
