// Accesso per i test end-to-end (smoke.ts, e2e-flussi.ts), compresa la pagina del codice della verifica
// in due passaggi: il codice si calcola dalla chiave dell'account, come farebbe l'app sul telefono.
import type { Page } from "playwright";
import { codiceDelPasso, passoDi, SECONDI_PER_PASSO } from "../src/lib/auth/totp";

/** Il codice che l'app mostrerebbe adesso per questa chiave. */
export function codiceAdesso(chiave: string) {
  return codiceDelPasso(chiave.replace(/\s/g, ""), passoDi(Date.now()));
}

/** Attende l'inizio del prossimo passo di 30 secondi (un codice appena usato non vale due volte). */
export async function attendiPassoSuccessivo() {
  const periodo = SECONDI_PER_PASSO * 1000;
  await new Promise((r) => setTimeout(r, periodo - (Date.now() % periodo) + 500));
}

/** Compila la pagina del codice; se il codice è appena stato usato aspetta il successivo e riprova. */
export async function inserisciCodice(page: Page, chiave: string) {
  for (let tentativo = 0; tentativo < 2; tentativo++) {
    await page.fill('input[name="codice"]', codiceAdesso(chiave));
    await Promise.all([
      page.waitForURL((u) => u.pathname !== "/login/codice", { timeout: 10000 }).catch(() => null),
      page.click('button[type="submit"]:has-text("Accedi")'),
    ]);
    if (new URL(page.url()).pathname !== "/login/codice") return;
    const testo = (await page.textContent("body")) ?? "";
    if (!testo.includes("appena stato usato")) throw new Error(`Codice rifiutato: ${testo.replace(/\s+/g, " ").slice(0, 200)}`);
    await attendiPassoSuccessivo();
  }
  throw new Error("Codice rifiutato due volte");
}

/**
 * Email e password; se l'account ha la verifica in due passaggi serve la sua chiave (parametro o
 * variabile E2E_TOTP_SECRET, la chiave mostrata in Impostazioni all'attivazione).
 */
export async function accedi(page: Page, base: string, email: string, password: string, chiave = process.env.E2E_TOTP_SECRET) {
  await page.goto(`${base}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([page.waitForURL((u) => u.pathname !== "/login", { timeout: 20000 }), page.click('button[type="submit"]')]);
  if (new URL(page.url()).pathname !== "/login/codice") return;
  if (!chiave) throw new Error(`${email} ha la verifica in due passaggi attiva: imposta E2E_TOTP_SECRET con la chiave dell'account.`);
  await inserisciCodice(page, chiave);
}
