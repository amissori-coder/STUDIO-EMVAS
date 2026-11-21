/* eslint-disable no-console */
// Test end-to-end di alcuni flussi chiave (richiede server avviato con dati demo):
//  - filtro intervallo scadenze usato dai link "riassegna" delle assenze
//  - invalidazione delle altre sessioni al cambio password
//  - upload e download di un documento dal portale clienti
//  - verifica in due passaggi: attivazione, codice all'accesso, riuso, codici di recupero, invito,
//    disattivazione, azzeramento da amministratore, blocco dopo troppi codici errati
// Uso: BASE_URL=http://localhost:3000 npx tsx scripts/e2e-flussi.ts
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import fs from "node:fs";
import { accedi, attendiPassoSuccessivo, codiceAdesso, inserisciCodice } from "./accesso-e2e";
import { codiceDelPasso, generaCodiciRecupero, generaSegreto, impronta, passoDi } from "../src/lib/auth/totp";
import path from "node:path";
import os from "node:os";
import { PrismaClient } from "@prisma/client";

// Le credenziali sono quelle con cui il seed ha creato l'amministratore (ADMIN_EMAIL e ADMIN_PASSWORD
// nel file .env); le variabili d'ambiente, se presenti, hanno la precedenza.
try {
  process.loadEnvFile();
} catch {
  // nessun file .env
}

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN = { email: process.env.ADMIN_EMAIL ?? "a.missori@emvas.tax", password: process.env.ADMIN_PASSWORD ?? "CambiaSubito123!" };
const exePath = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
const prisma = new PrismaClient();
let failures = 0;

function check(cond: boolean, label: string, extra = "") {
  if (!cond) failures++;
  console.log(`${cond ? "OK " : "ERR"} ${label}${extra ? " " + extra : ""}`);
}

async function login(page: Page, email: string, password: string) {
  await accedi(page, BASE, email, password);
}

const COLLAB = { email: "collaboratore@studio.local", password: "Collaboratore123!" };

/** Un codice di 6 cifre sicuramente sbagliato adesso (diverso da quelli dei passi accettati). */
function codiceSbagliato(chiave: string) {
  const p = passoDi(Date.now());
  const validi = new Set([-1, 0, 1, 2].map((d) => codiceDelPasso(chiave, p + d)));
  for (let n = 0; ; n++) {
    const c = String(n).padStart(6, "0");
    if (!validi.has(c)) return c;
  }
}

async function nuovaPagina(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  return { ctx, page: await ctx.newPage() };
}

async function soloPassword(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([page.waitForURL((u) => u.pathname !== "/login", { timeout: 20000 }).catch(() => null), page.click('button[type="submit"]')]);
}

async function inviaCodice(page: Page, codice: string) {
  await page.fill('input[name="codice"]', codice);
  await Promise.all([page.waitForLoadState("networkidle").catch(() => null), page.click('button[type="submit"]:has-text("Accedi")')]);
  await page.waitForTimeout(800);
  return (await page.textContent("body")) ?? "";
}

async function verificaDuePassaggi(browser: Browser, collabId: string) {
  const contesti: BrowserContext[] = [];
  const apri = async () => {
    const p = await nuovaPagina(browser);
    contesti.push(p.ctx);
    return p.page;
  };
  try {
    // attivazione, con una seconda sessione aperta prima
    const vecchia = await apri();
    await accedi(vecchia, BASE, COLLAB.email, COLLAB.password);
    const pagina = await apri();
    await accedi(pagina, BASE, COLLAB.email, COLLAB.password);
    await pagina.goto(`${BASE}/impostazioni`);
    await pagina.click('button:has-text("Attiva la verifica in due passaggi")');
    const chiave = ((await pagina.locator("#verifica-due-passaggi span.select-all").first().textContent({ timeout: 15000 })) ?? "").replace(/\s/g, "");
    check(chiave.length === 32, "chiave mostrata per l'inserimento manuale");
    check((await pagina.locator("#verifica-due-passaggi svg").count()) > 0, "codice QR mostrato");
    const statoMeta = await prisma.user.findUniqueOrThrow({ where: { id: collabId } });
    check(!statoMeta.totpAttivo, "prima della conferma la verifica non è ancora richiesta");

    await pagina.fill("#totp-conferma", codiceSbagliato(chiave));
    await pagina.click('button:has-text("Conferma e attiva")');
    check(await pagina.waitForSelector("text=Codice non valido", { timeout: 10000 }).then(() => true).catch(() => false), "un codice errato non attiva la verifica");
    await pagina.fill("#totp-conferma", codiceAdesso(chiave));
    await pagina.click('button:has-text("Conferma e attiva")');
    const mostrati = await pagina.waitForSelector("text=Salva adesso questi codici", { timeout: 15000 }).then(() => true).catch(() => false);
    check(mostrati, "dopo la conferma compaiono i codici di recupero");
    const codici = (await pagina.locator("#verifica-due-passaggi ul.font-mono li").allTextContents()).map((c) => c.trim());
    check(codici.length === 10, "dieci codici di recupero", String(codici.length));
    await pagina.reload();
    check(((await pagina.textContent("#verifica-due-passaggi")) ?? "").includes("Codici di recupero ancora validi: 10"), "dopo il ricaricamento i codici non si vedono più, solo quanti sono");
    const rVecchia = await vecchia.goto(`${BASE}/dashboard`);
    check(!!rVecchia && rVecchia.url().includes("/login"), "l'altra sessione, entrata senza codice, viene chiusa", rVecchia?.url());
    const rPagina = await pagina.goto(`${BASE}/dashboard`);
    check(!!rPagina && rPagina.url().includes("/dashboard"), "la sessione che ha attivato la verifica resta aperta");

    // accesso: la password da sola non basta
    const prima = (await prisma.user.findUniqueOrThrow({ where: { id: collabId } })).lastLoginAt?.getTime();
    const a = await apri();
    await soloPassword(a, COLLAB.email, COLLAB.password);
    check(a.url().includes("/login/codice"), "dopo la password viene chiesto il codice", a.url());
    check((await prisma.user.findUniqueOrThrow({ where: { id: collabId } })).lastLoginAt?.getTime() === prima, "l'ultimo accesso non cambia prima del codice");
    const rSenza = await a.goto(`${BASE}/dashboard`);
    check(!!rSenza && rSenza.url().includes("/login"), "senza codice nessuna pagina riservata si apre", rSenza?.url());
    const api = await a.request.get(`${BASE}/api/notifiche`);
    check(api.status() === 401, "senza codice le API rispondono 401", String(api.status()));
    await a.goto(`${BASE}/login/codice`);
    check((await inviaCodice(a, codiceSbagliato(chiave))).includes("Codice non valido"), "codice errato all'accesso rifiutato");
    await inserisciCodice(a, chiave);
    check(a.url().includes("/dashboard"), "con il codice giusto si entra", a.url());
    const ultimo = await prisma.user.findUniqueOrThrow({ where: { id: collabId } });
    check(ultimo.lastLoginAt?.getTime() !== prima, "l'ultimo accesso si aggiorna dopo il codice");

    // lo stesso codice non vale una seconda volta
    const usato = codiceDelPasso(chiave, ultimo.totpUltimoPasso!);
    const b = await apri();
    await soloPassword(b, COLLAB.email, COLLAB.password);
    check((await inviaCodice(b, usato)).includes("appena stato usato"), "un codice già usato viene rifiutato con la spiegazione");

    // codici di recupero: valgono una volta
    await b.click("text=Non hai il telefono? Usa un codice di recupero");
    await inviaCodice(b, codici[0]!.toUpperCase());
    check(b.url().includes("/impostazioni") || b.url().includes("/dashboard"), "si entra con un codice di recupero", b.url());
    const dopoRecupero = await prisma.user.findUniqueOrThrow({ where: { id: collabId } });
    check(dopoRecupero.totpRecupero?.split(",").length === 9, "il codice di recupero usato viene consumato");
    const c = await apri();
    await soloPassword(c, COLLAB.email, COLLAB.password);
    await c.click("text=Non hai il telefono? Usa un codice di recupero");
    check((await inviaCodice(c, codici[0]!)).includes("Codice non valido"), "lo stesso codice di recupero non vale due volte");

    // disattivazione: un codice appena usato è spiegato, poi password + codice nuovo
    await prisma.user.update({ where: { id: collabId }, data: { totpUltimoPasso: passoDi(Date.now()) } });
    await a.goto(`${BASE}/impostazioni`);
    await a.click("text=Disattiva la verifica in due passaggi");
    await a.fill("#totp-password", COLLAB.password);
    await a.fill("#totp-disattiva", codiceAdesso(chiave));
    await a.click('button[type="submit"]:has-text("Disattiva")');
    check(await a.waitForSelector("text=appena stato usato", { timeout: 10000 }).then(() => true).catch(() => false), "disattivare con un codice appena usato spiega di attendere il prossimo");
    await attendiPassoSuccessivo();
    await a.fill("#totp-password", "PasswordSbagliata1");
    await a.fill("#totp-disattiva", codiceAdesso(chiave));
    await a.click('button[type="submit"]:has-text("Disattiva")');
    check(await a.waitForSelector("text=La password non è corretta", { timeout: 10000 }).then(() => true).catch(() => false), "senza la password giusta non si disattiva");
    await a.fill("#totp-password", COLLAB.password);
    await a.fill("#totp-disattiva", codiceAdesso(chiave));
    await a.click('button[type="submit"]:has-text("Disattiva")');
    check(await a.waitForSelector("text=Verifica in due passaggi disattivata", { timeout: 10000 }).then(() => true).catch(() => false), "la disattivazione è confermata a schermo");
    check(!(await prisma.user.findUniqueOrThrow({ where: { id: collabId } })).totpAttivo, "verifica disattivata nel database");

    // invito rimandato: reimposta la password ma non salta il codice
    const segreto = generaSegreto();
    const attiva = { totpAttivo: true, totpSecret: segreto, totpRecupero: generaCodiciRecupero().map(impronta).join(","), totpConfermato: new Date(), totpUltimoPasso: null };
    const token = (await import("node:crypto")).randomBytes(32).toString("hex");
    await prisma.user.update({ where: { id: collabId }, data: { ...attiva, inviteToken: token, inviteExpires: new Date(Date.now() + 3600_000) } });
    const inv = await apri();
    await inv.goto(`${BASE}/invito/${token}`);
    await inv.fill('input[name="password"]', COLLAB.password);
    await inv.fill('input[name="conferma"]', COLLAB.password);
    await Promise.all([inv.waitForURL((u) => !u.pathname.startsWith("/invito"), { timeout: 15000 }).catch(() => null), inv.click('button[type="submit"]')]);
    check(inv.url().includes("/login/codice"), "accettare un invito con la verifica attiva porta al codice", inv.url());
    await inserisciCodice(inv, segreto);
    check(inv.url().includes("/dashboard"), "dopo il codice l'invito porta dentro", inv.url());

    // azzeramento da amministratore
    const adm = await apri();
    await accedi(adm, BASE, ADMIN.email, ADMIN.password);
    await adm.goto(`${BASE}/team`);
    adm.once("dialog", (d) => d.accept());
    const scheda = adm.locator("li", { hasText: COLLAB.email });
    await scheda.locator('button:has-text("Azzera verifica in due passaggi")').click();
    check(await adm.waitForSelector("text=azzerata: ora si accede con la sola password", { timeout: 10000 }).then(() => true).catch(() => false), "l'amministratore vede la conferma dell'azzeramento");
    const azzerato = await prisma.user.findUniqueOrThrow({ where: { id: collabId } });
    check(!azzerato.totpAttivo && !azzerato.totpSecret, "verifica azzerata nel database");
    check(!!(await prisma.notification.findFirst({ where: { userId: collabId, titolo: "Verifica in due passaggi azzerata" } })), "la persona riceve l'avviso dell'azzeramento");
    const rInv = await inv.goto(`${BASE}/dashboard`);
    check(!!rInv && rInv.url().includes("/login"), "dopo l'azzeramento le sessioni della persona sono chiuse", rInv?.url());
    const d = await apri();
    await accedi(d, BASE, COLLAB.email, COLLAB.password, "");
    check(d.url().includes("/dashboard"), "dopo l'azzeramento basta la password");
    check(!!(await prisma.auditLog.findFirst({ where: { azione: "TOTP_AZZERATA_DA_ADMIN", entitaId: collabId } })), "azzeramento nel registro delle operazioni");

    // troppi codici errati: blocco e avviso alla persona
    const segreto2 = generaSegreto();
    await prisma.user.update({ where: { id: collabId }, data: { ...attiva, totpSecret: segreto2 } });
    const e = await apri();
    await soloPassword(e, COLLAB.email, COLLAB.password);
    let testo = "";
    for (let i = 0; i < 6; i++) testo = await inviaCodice(e, codiceSbagliato(segreto2));
    check(testo.includes("Troppi codici errati"), "dopo cinque codici errati i tentativi si bloccano");
    check(!!(await prisma.notification.findFirst({ where: { userId: collabId, titolo: "Codici di accesso errati" } })), "la persona viene avvisata dei codici errati");
    check((await inviaCodice(e, codiceAdesso(segreto2))).includes("Troppi codici errati"), "durante il blocco anche il codice giusto attende");
  } finally {
    // stato iniziale: verifica spenta, password e invito come prima
    await prisma.user.update({
      where: { id: collabId },
      data: { totpAttivo: false, totpSecret: null, totpRecupero: null, totpConfermato: null, totpUltimoPasso: null, inviteToken: null, inviteExpires: null },
    });
    await prisma.user.update({ where: { id: collabId }, data: { passwordHash: (await import("bcryptjs")).default.hashSync(COLLAB.password, 10) } });
    await Promise.all(contesti.map((c) => c.close()));
  }
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
    await login(admin, ADMIN.email, ADMIN.password);
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

    // 4. verifica in due passaggi
    await verificaDuePassaggi(browser, collab.id);
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
