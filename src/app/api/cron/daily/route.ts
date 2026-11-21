import { NextResponse, type NextRequest } from "next/server";
import { giornalieriRegistrati } from "@/lib/cron/jobs";
import { authorizeCron } from "@/lib/cron/auth";

/**
 * Esegue i job giornalieri (promemoria scadenze, allerta assenze).
 * Autorizzazione: header "Authorization: Bearer CRON_SECRET" (GET o POST) oppure sessione amministratore (solo POST).
 */
async function handler(request: NextRequest) {
  if (!(await authorizeCron(request, "daily"))) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const r = await giornalieriRegistrati("HTTP");
  // 409: un'altra esecuzione è in corso (lucchetto), niente è stato eseguito
  if (!r.eseguito) return NextResponse.json({ error: r.motivo }, { status: 409 });
  return NextResponse.json({ esito: r.esito, ...r.risultato });
}

export const GET = handler;
export const POST = handler;
