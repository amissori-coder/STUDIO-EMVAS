import { NextResponse, type NextRequest } from "next/server";
import { eseguiJobGiornalieri } from "@/lib/cron/jobs";
import { authorizeCron } from "@/lib/cron/auth";

/**
 * Esegue i job giornalieri (promemoria scadenze, allerta assenze).
 * Autorizzazione: header "Authorization: Bearer CRON_SECRET" (GET o POST) oppure sessione amministratore (solo POST).
 */
async function handler(request: NextRequest) {
  if (!(await authorizeCron(request, "daily"))) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const result = await eseguiJobGiornalieri();
  return NextResponse.json(result);
}

export const GET = handler;
export const POST = handler;
