import { NextResponse, type NextRequest } from "next/server";
import { destroySession } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

/** Logout: solo POST (un GET consentirebbe a pagine terze di forzare l'uscita con un semplice link). */
export async function POST(request: NextRequest) {
  // Il modulo di uscita (EsciForm) manda l'indirizzo della sottoscrizione push di questo dispositivo:
  // la si cancella, così chi usa il computer dopo non riceve avvisi con i dati dei clienti.
  // Qualunque errore qui non deve impedire l'uscita.
  try {
    const dati = await request.formData();
    const endpoint = String(dati.get("endpoint") ?? "").trim();
    const user = endpoint ? await getCurrentUser() : null;
    if (user) await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  } catch {
    // corpo assente o non leggibile: si esce comunque
  }
  await destroySession();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
