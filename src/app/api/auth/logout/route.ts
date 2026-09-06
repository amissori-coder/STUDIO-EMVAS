import { NextResponse, type NextRequest } from "next/server";
import { destroySession } from "@/lib/auth/session";

/** Logout: solo POST (un GET consentirebbe a pagine terze di forzare l'uscita con un semplice link). */
export async function POST(request: NextRequest) {
  await destroySession();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
