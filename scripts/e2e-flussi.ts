/* eslint-disable no-console */
// Test end-to-end di alcuni flussi chiave (richiede server avviato con dati demo):
//  - filtro intervallo scadenze usato dai link "riassegna" delle assenze
//  - invalidazione delle altre sessioni al cambio password
//  - upload e download di un documento dal portale clienti
// Uso: BASE_URL=http://localhost:3000 npx tsx scripts/e2e-flussi.ts
import { chromium, type BrowserContext, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const exePath = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
const prisma = new PrismaClient();
let failures = 0;

function check(cond: boolean, label: string, extra = "") {
  if (!cond) failures++;
  console.log(`${cond ? "OK " : "ERR"} ${label}${extra ? " " + extra : ""}`);
}

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }), page.click('button[type="submit"]')]);
}

async function main() {
  const browser = await chromium.launch({ executablePath: exePath });
  try {
    const collab = await prisma.user.findUnique({ where: { email: "collaboratore@studio.local" } });
    const cliente = await prisma.client.findFirst({ where: { email: "amministrazione@rossi-impianti.it" }, include: { cartelle: { orderBy: { ordine: "asc" } } } });
    if (!collab || !cliente) throw new Error("Dati demo assenti: esegui SEED_DEMO=1 npm run setup");

    // 1. filtro intervallo scadenze
    const ctxA: BrowserContext = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const admin = await ctxA.newPage();
    await login(admin, "a.missori@emvas.tax", "CambiaSubito123!");
    await admin.goto(`${BASE}/attivita?assegnatario=${collab.id}&stato=aperte&ordina=scadenza&a=2026-09-13`);
    const testo = (await admin.textContent("body")) ?? "";
    check(testo.includes("entro il 13/09/2026"), "filtro ?a= mostra il chip dell'intervallo");
    check(testo.includes("incluse le scadute"), "filtro ?a= da solo include le scadute");

    // 2. invalidazione sessioni: due sessioni del collaboratore, cambio password dalla seconda
    const ctxB = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const ctxC = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const pB = await ctxB.newPage();
    const pC = await ctxC.newPage();
    await login(pB, "collaboratore@studio.local", "Collaboratore123!");
    await login(pC, "collaboratore@studio.local", "Collaboratore123!");
    await pC.goto(`${BASE}/impostazioni`);
    await pC.fill('input[name="attuale"]', "Collaboratore123!");
    await pC.fill('input[name="nuova"]', "NuovaPassword456!");
    await pC.fill('input[name="conferma"]', "NuovaPassword456!");
    await pC.click('button:has-text("Cambia password")');
    await pC.waitForSelector("text=Password aggiornata", { timeout: 15000 }).catch(() => {});
    const okC = (await pC.textContent("body"))?.includes("Password aggiornata") ?? false;
    check(okC, "cambio password riuscito");
    const rC = await pC.goto(`${BASE}/dashboard`);
    check(!!rC && rC.url().includes("/dashboard"), "la sessione che ha cambiato la password resta valida");
    const rB = await pB.goto(`${BASE}/dashboard`);
    check(!!rB && rB.url().includes("/login"), "l'altra sessione viene invalidata", rB?.url());
    // ripristino password
    await prisma.user.update({ where: { id: collab.id }, data: { passwordHash: (await import("bcryptjs")).default.hashSync("Collaboratore123!", 10) } });

    // 3. portale: upload e download
    const ctxD = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const pD = await ctxD.newPage();
    await login(pD, "cliente@rossi-impianti.it", "Cliente123!");
    const cartella = cliente.cartelle.find((c) => c.visibileCliente && c.clientePuoCaricare) ?? cliente.cartelle[0];
    await pD.goto(`${BASE}/portale/cartelle/${cartella.id}`);
    const tmp = path.join(os.tmpdir(), `test-emvas-${Date.now()}.pdf`);
    fs.writeFileSync(tmp, "%PDF-1.4\n%test\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
    const input = pD.locator('input[type="file"]').first();
    await input.setInputFiles(tmp);
    const submit = pD.locator('button:has-text("Carica il file")').first();
    const [uploadResp] = await Promise.all([
      pD.waitForResponse((r) => r.url().includes("/api/documenti/upload"), { timeout: 30000 }),
      submit.click(),
    ]);
    check(uploadResp.status() === 201 || uploadResp.status() === 200, "upload dal portale riuscito", String(uploadResp.status()));
    const nome = path.basename(tmp);
    const comparso = await pD.waitForSelector(`a:has-text("${nome}"), li:has-text("${nome}")`, { timeout: 20000 }).then(() => true).catch(() => false);
    check(comparso, "documento caricato dal portale compare nell'elenco");
    const doc = await prisma.document.findFirst({ where: { nome, clientId: cliente.id } });
    check(!!doc, "documento salvato nel database");
    if (doc) {
      const resp = await pD.request.get(`${BASE}/api/documenti/${doc.id}`);
      check(resp.status() === 200, "download documento 200", String(resp.status()));
      check((resp.headers()["content-disposition"] ?? "").includes("inline") || (resp.headers()["content-disposition"] ?? "").includes("attachment"), "Content-Disposition presente");
      const notifica = await prisma.notification.findFirst({ where: { tipo: "DOCUMENTO_CARICATO", corpo: { contains: nome } } });
      check(!!notifica, "notifica al referente per il documento caricato");
      // accesso di un altro cliente negato: creo un utente cliente di un altro cliente
      const altro = await prisma.client.findFirst({ where: { id: { not: cliente.id } } });
      if (altro) {
        const ctxE = await browser.newContext();
        const pE = await ctxE.newPage();
        const email = `altro-${Date.now()}@test.local`;
        const bcrypt = (await import("bcryptjs")).default;
        const u = await prisma.user.create({ data: { email, nome: "Altro Cliente", ruolo: "CLIENTE", passwordHash: bcrypt.hashSync("Altro12345", 10), accessiClienti: { create: { clientId: altro.id } } } });
        await login(pE, email, "Altro12345");
        const r = await pE.request.get(`${BASE}/api/documenti/${doc.id}`);
        check(r.status() === 403 || r.status() === 404, "documento di un altro cliente non accessibile", String(r.status()));
        await prisma.user.delete({ where: { id: u.id } });
        await ctxE.close();
      }
      // pulizia
      await pD.request.delete(`${BASE}/api/documenti/${doc.id}`).catch(() => {});
      await prisma.document.deleteMany({ where: { id: doc.id } });
    }
    fs.unlinkSync(tmp);
    await Promise.all([ctxA.close(), ctxB.close(), ctxC.close(), ctxD.close()]);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
  console.log(failures ? `\n${failures} problemi rilevati` : "\nFlussi verificati");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
