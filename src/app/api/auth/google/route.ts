import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { buildGoogleAuthUrl, isGoogleConfigured } from "@/lib/auth/google";
import { getCurrentUser, isStaff } from "@/lib/auth/guards";

const GOOGLE_STATE_COOKIE = "emvas_google_state";

/** Avvia il flusso OAuth Google. mode=login (accesso staff) oppure mode=connect (collega Gmail all'utente corrente). */
export async function GET(request: NextRequest) {
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/login?errore=google-non-configurato", request.url));
  }
  const mode = request.nextUrl.searchParams.get("mode") === "connect" ? "connect" : "login";
  const next = request.nextUrl.searchParams.get("next") ?? "";
  let loginHint: string | undefined;

  if (mode === "connect") {
    const user = await getCurrentUser();
    if (!user || !isStaff(user)) return NextResponse.redirect(new URL("/login", request.url));
    loginHint = user.email;
  }

  const nonce = randomBytes(16).toString("hex");
  const state = Buffer.from(JSON.stringify({ n: nonce, mode, next })).toString("base64url");
  const res = NextResponse.redirect(buildGoogleAuthUrl(state, { loginHint }));
  res.cookies.set(GOOGLE_STATE_COOKIE, nonce, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
