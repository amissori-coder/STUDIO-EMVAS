/* eslint-disable no-console */
// Smoke test end-to-end: avvia un browser, effettua il login e visita le pagine principali
// (desktop e mobile), segnalando errori di console/pagina. Uso: BASE_URL=http://localhost:3000 npx tsx scripts/smoke.ts
import { chromium, type Page } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN = { email: process.env.ADMIN_EMAIL ?? "a.missori@emvas.tax", password: process.env.ADMIN_PASSWORD ?? "CambiaSubito123!" };
const CLIENTE = { email: "cliente@rossi-impianti.it", password: "Cliente123!" };
const OUT = process.env.SCREENSHOT_DIR ?? "screenshots";
const exePath = process.env.CHROMIUM_PATH ?? (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

const STAFF_PAGES = ["/dashboard", "/clienti", "/attivita", "/scadenzario", "/email", "/chat", "/team", "/adempimenti", "/notifiche", "/impostazioni"];
const PORTAL_PAGES = ["/portale"];

let failures = 0;

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }), page.click('button[type="submit"]')]);
}

async function visit(page: Page, path: string, label: string) {
  const errors: string[] = [];
  const onConsole = (m: { type(): string; text(): string }) => {
    if (m.type() === "error") errors.push(m.text());
  };
  const onPageError = (e: Error) => errors.push(`pageerror: ${e.message}`);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 30000 });
  const status = res?.status() ?? 0;
  const body = await page.textContent("body");
  const hasErrorText = /Application error|Unhandled Runtime Error|Internal Server Error/i.test(body ?? "");
  await page.screenshot({ path: `${OUT}/${label}${path.replace(/[\/?=&]/g, "_")}.png`, fullPage: true });
  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  const relevant = errors.filter((e) => !/favicon|service worker|sw\.js|hydrat/i.test(e));
  const ok = status < 400 && !hasErrorText && relevant.length === 0;
  if (!ok) failures++;
  console.log(`${ok ? "OK " : "ERR"} ${label} ${path} [${status}]${relevant.length ? " console: " + relevant.join(" | ").slice(0, 300) : ""}${hasErrorText ? " (testo di errore in pagina)" : ""}`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: exePath });
  try {
    for (const [label, viewport] of [["desktop", { width: 1366, height: 900 }], ["mobile", { width: 390, height: 844 }]] as const) {
      const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: label === "mobile", hasTouch: label === "mobile" });
      const page = await ctx.newPage();
      await login(page, ADMIN.email, ADMIN.password);
      console.log(`[${label}] login admin -> ${page.url()}`);
      for (const p of STAFF_PAGES) await visit(page, p, label);
      // prima scheda cliente disponibile
      await page.goto(`${BASE}/clienti`);
      const hrefs = await page.locator('a[href^="/clienti/"]').evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
      const firstClient = hrefs.find((h) => /^\/clienti\/(?!nuovo$)[^/?]+$/.test(h)) ?? null;
      if (firstClient && /^\/clienti\/[^/?]+$/.test(firstClient)) {
        for (const tab of ["", "?tab=attivita", "?tab=email", "?tab=chat", "?tab=documenti"]) await visit(page, `${firstClient}${tab}`, label);
      } else {
        console.log(`[${label}] nessuna scheda cliente trovata`);
      }
      await ctx.close();

      const ctx2 = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: label === "mobile", hasTouch: label === "mobile" });
      const page2 = await ctx2.newPage();
      try {
        await login(page2, CLIENTE.email, CLIENTE.password);
        console.log(`[${label}] login cliente -> ${page2.url()}`);
        for (const p of PORTAL_PAGES) await visit(page2, p, `${label}-portale`);
        // lo staff non deve entrare nel portale e il cliente non nello studio
        const r = await page2.goto(`${BASE}/dashboard`);
        console.log(`[${label}] cliente su /dashboard -> ${r?.url()} (atteso /portale)`);
        if (!(r?.url() ?? "").includes("/portale")) failures++;
      } catch (e) {
        console.log(`[${label}] login cliente non riuscito (dati demo assenti?): ${(e as Error).message.split("\n")[0]}`);
      }
      await ctx2.close();
    }
  } finally {
    await browser.close();
  }
  console.log(failures ? `\n${failures} problemi rilevati` : "\nSmoke test superato");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
