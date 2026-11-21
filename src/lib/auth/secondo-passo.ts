import "server-only";
import { cookies } from "next/headers";
import { firmaSecondoPasso, leggiSecondoPassoToken, SECONDO_PASSO_MINUTI, type SecondoPasso } from "@/lib/auth/jwt";

/** Cookie del passaggio intermedio dell'accesso: dice solo «password giusta, manca il codice». */
export const COOKIE_SECONDO_PASSO = "emvas_secondo_passo";

export async function avviaSecondoPasso(p: SecondoPasso) {
  const store = await cookies();
  store.set(COOKIE_SECONDO_PASSO, await firmaSecondoPasso(p), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && (process.env.APP_URL ?? "").startsWith("https"),
    path: "/",
    maxAge: SECONDO_PASSO_MINUTI * 60,
  });
}

export async function leggiSecondoPasso() {
  const store = await cookies();
  return leggiSecondoPassoToken(store.get(COOKIE_SECONDO_PASSO)?.value);
}

export async function chiudiSecondoPasso() {
  const store = await cookies();
  store.delete(COOKIE_SECONDO_PASSO);
}
