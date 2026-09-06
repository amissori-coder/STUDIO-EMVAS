import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth/jwt";
import { SESSION_COOKIE } from "@/lib/constants";

// Percorsi pubblici (nessuna sessione richiesta)
const PUBLIC_PREFIXES = [
  "/login",
  "/invito",
  "/api/auth",
  "/api/cron",
  "/api/health",
  "/manifest.webmanifest",
  "/sw.js",
  "/icons",
  "/favicon.ico",
];

// Percorsi consentiti agli utenti CLIENTE (portale)
const CLIENT_PREFIXES = ["/portale", "/api/portale", "/api/documenti", "/api/notifiche", "/api/push"];

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (startsWithAny(pathname, PUBLIC_PREFIXES)) {
    return NextResponse.next();
  }

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const isApi = pathname.startsWith("/api/");

  if (!session) {
    if (isApi) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(session.ruolo === "CLIENTE" ? "/portale" : "/dashboard", request.url));
  }

  if (session.ruolo === "CLIENTE") {
    if (!startsWithAny(pathname, CLIENT_PREFIXES)) {
      if (isApi) return NextResponse.json({ error: "Accesso non consentito" }, { status: 403 });
      return NextResponse.redirect(new URL("/portale", request.url));
    }
    return NextResponse.next();
  }

  // Staff: il portale è riservato ai clienti
  if (pathname === "/portale" || pathname.startsWith("/portale/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|gif|ico|webp|woff2?)$).*)"],
};
