import { NextResponse, type NextRequest } from "next/server";
import { eseguiJobGiornalieri } from "@/lib/cron/jobs";
import { getCurrentUser, isAdmin } from "@/lib/auth/guards";

/**
 * Esegue i job giornalieri (promemoria scadenze, allerta assenze).
 * Autorizzazione: header "Authorization: Bearer CRON_SECRET" (o ?secret=) oppure sessione amministratore.
 */
async function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth === `Bearer ${secret}` || request.nextUrl.searchParams.get("secret") === secret) return true;
  }
  const user = await getCurrentUser();
  return isAdmin(user);
}

async function handler(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const result = await eseguiJobGiornalieri();
  return NextResponse.json(result);
}

export const GET = handler;
export const POST = handler;
