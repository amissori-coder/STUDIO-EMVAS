import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { JOB_PIANIFICATI, type NomeJob } from "@/lib/cron/stato";
import { endOfDayLocal, parseDateInput, startOfDayLocal } from "@/lib/utils";
import { autoreAssente, azioniDelGruppo, GRUPPI, idCitati, leggiDettagli } from "./etichette";

export const REGISTRO_PAGE_SIZE = 50;

export interface FiltriRegistro {
  persona: string;
  gruppo: string;
  azione: string;
  entita: string;
  oggetto: string;
  da: string;
  a: string;
  q: string;
  pagina: number;
}

export function leggiFiltri(sp: Record<string, string | string[] | undefined>): FiltriRegistro {
  const str = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 200) ?? "";
  };
  return {
    persona: str("persona"),
    gruppo: str("gruppo") in GRUPPI ? str("gruppo") : "",
    azione: /^[A-Z_]{2,60}$/.test(str("azione")) ? str("azione") : "",
    entita: /^[A-Za-z]{2,40}$/.test(str("entita")) ? str("entita") : "",
    oggetto: str("oggetto"),
    da: str("da"),
    a: str("a"),
    q: str("q"),
    pagina: Math.max(1, Number.parseInt(str("pagina") || "1", 10) || 1),
  };
}

function condizioni(f: FiltriRegistro): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (f.persona === "nessuno") and.push({ userId: null });
  else if (f.persona) and.push({ userId: f.persona });
  if (f.azione) and.push({ azione: f.azione });
  else if (f.gruppo) and.push({ azione: { in: azioniDelGruppo(f.gruppo) } });
  if (f.entita) and.push({ entita: f.entita });
  if (f.oggetto) and.push({ entitaId: f.oggetto });
  const da = parseDateInput(f.da);
  const a = parseDateInput(f.a);
  // giorni interi nell'ora del server (TZ=Europe/Rome), la stessa con cui le righe sono mostrate
  if (da) and.push({ createdAt: { gte: startOfDayLocal(da) } });
  if (a) and.push({ createdAt: { lte: endOfDayLocal(a) } });
  // su SQLite contains ignora le maiuscole per l'ASCII; su PostgreSQL servirà mode: "insensitive"
  if (f.q) and.push({ dettagli: { contains: f.q } });
  return and.length ? { AND: and } : {};
}

export interface OggettoRegistro {
  etichetta: string;
  href: string | null;
  /** true solo quando l'esistenza è stata verificata e l'oggetto non c'è più */
  rimosso: boolean;
}

/**
 * Nome e collegamento degli oggetti citati dalle righe, con un'interrogazione per tipo. Per i tipi senza
 * pagina propria non si afferma nulla sull'esistenza: dire «non più presente» senza averlo verificato
 * sarebbe falso.
 */
async function risolviOggetti(righe: { entita: string; entitaId: string | null; dettagli: Record<string, unknown> | null }[]) {
  const ids = (tipo: string) => [...new Set(righe.filter((r) => r.entita === tipo && r.entitaId).map((r) => r.entitaId!))];
  const [clienti, attivita, utenti, documenti, email, adempimenti] = await Promise.all([
    prisma.client.findMany({ where: { id: { in: ids("Client") } }, select: { id: true, denominazione: true } }),
    prisma.task.findMany({ where: { id: { in: ids("Task") } }, select: { id: true, titolo: true } }),
    prisma.user.findMany({ where: { id: { in: ids("User") } }, select: { id: true, nome: true, ruolo: true } }),
    prisma.document.findMany({ where: { id: { in: ids("Document") } }, select: { id: true, nome: true, clientId: true } }),
    prisma.emailMessage.findMany({ where: { id: { in: ids("EmailMessage") } }, select: { id: true, subject: true } }),
    prisma.adempimentoTemplate.findMany({ where: { id: { in: ids("AdempimentoTemplate") } }, select: { id: true, nome: true } }),
  ]);
  const mappa = new Map<string, OggettoRegistro>();
  for (const c of clienti) mappa.set(`Client:${c.id}`, { etichetta: c.denominazione, href: `/clienti/${c.id}`, rimosso: false });
  for (const t of attivita) mappa.set(`Task:${t.id}`, { etichetta: t.titolo, href: `/attivita/${t.id}`, rimosso: false });
  for (const d of documenti) mappa.set(`Document:${d.id}`, { etichetta: d.nome, href: `/clienti/${d.clientId}?tab=documenti`, rimosso: false });
  for (const e of email) mappa.set(`EmailMessage:${e.id}`, { etichetta: e.subject || "(senza oggetto)", href: `/email/${e.id}`, rimosso: false });
  for (const t of adempimenti) mappa.set(`AdempimentoTemplate:${t.id}`, { etichetta: t.nome, href: `/adempimenti/${t.id}`, rimosso: false });
  const utentiMap = new Map(utenti.map((u) => [u.id, u]));
  const verificati = new Set(["Client", "Task", "User", "Document", "EmailMessage", "AdempimentoTemplate"]);

  return (r: { entita: string; entitaId: string | null; dettagli: Record<string, unknown> | null }): OggettoRegistro | null => {
    if (!r.entitaId) return null;
    if (r.entita === "Cron") {
      const job = JOB_PIANIFICATI[r.entitaId as NomeJob];
      return job ? { etichetta: job.etichetta, href: "/impostazioni", rimosso: false } : null;
    }
    if (r.entita === "User") {
      const u = utentiMap.get(r.entitaId);
      if (!u) return { etichetta: String(r.dettagli?.nome ?? r.dettagli?.email ?? ""), href: null, rimosso: true };
      // un utente del portale: il collegamento porta al cliente su cui è avvenuta l'operazione
      const clientId = typeof r.dettagli?.clientId === "string" ? r.dettagli.clientId : null;
      if (u.ruolo === "CLIENTE") return { etichetta: u.nome, href: clientId ? `/clienti/${clientId}` : null, rimosso: false };
      return { etichetta: u.nome, href: "/team", rimosso: false };
    }
    const trovato = mappa.get(`${r.entita}:${r.entitaId}`);
    if (trovato) return trovato;
    if (verificati.has(r.entita)) {
      const d = r.dettagli;
      const annidato = (k: "dopo" | "prima") => (d?.[k] && typeof d[k] === "object" ? (d[k] as Record<string, unknown>).titolo : undefined);
      const nome = d?.denominazione ?? d?.titolo ?? d?.nome ?? annidato("dopo") ?? annidato("prima") ?? null;
      return { etichetta: nome ? String(nome) : "", href: null, rimosso: true };
    }
    return null; // tipo senza pagina propria: niente collegamento, nessuna affermazione sull'esistenza
  };
}

/** Nomi di persone, clienti e cartelle citati nei dettagli, con una sola interrogazione per tipo. */
async function nomiCitati(tutti: (Record<string, unknown> | null)[]) {
  const ids = [...new Set(tutti.flatMap((d) => [...idCitati(d)]))];
  if (!ids.length) return {};
  const [utenti, aziende, cartelle] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } }),
    prisma.client.findMany({ where: { id: { in: ids } }, select: { id: true, denominazione: true } }),
    prisma.documentFolder.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } }),
  ]);
  return Object.fromEntries([
    ...utenti.map((u) => [u.id, u.nome] as const),
    ...aziende.map((c) => [c.id, c.denominazione] as const),
    ...cartelle.map((c) => [c.id, `cartella «${c.nome}»`] as const),
  ]);
}

export async function caricaRegistro(f: FiltriRegistro) {
  const where = condizioni(f);
  const totale = await prisma.auditLog.count({ where });
  const pagine = Math.max(1, Math.ceil(totale / REGISTRO_PAGE_SIZE));
  // una pagina oltre la fine (indirizzo vecchio, righe filtrate) mostra l'ultima, non un falso «registro vuoto»
  const pagina = Math.min(f.pagina, pagine);
  const righe = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { id: true, nome: true, colore: true } } },
    // spareggio sull'id: righe scritte nello stesso istante non si duplicano né spariscono fra le pagine
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (pagina - 1) * REGISTRO_PAGE_SIZE,
    take: REGISTRO_PAGE_SIZE,
  });
  const lette = righe.map((r) => ({ ...r, letti: leggiDettagli(r.dettagli) }));
  const [oggettoDi, nomi] = await Promise.all([
    risolviOggetti(lette.map((r) => ({ entita: r.entita, entitaId: r.entitaId, dettagli: r.letti.dati }))),
    nomiCitati(lette.map((r) => r.letti.dati)),
  ]);
  return {
    totale,
    pagine,
    pagina,
    /** nome di ogni persona e cliente citati nei dettagli, per identificativo */
    nomi,
    righe: lette.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      azione: r.azione,
      entita: r.entita,
      autore: r.user ? { tipo: "persona" as const, ...r.user } : { tipo: autoreAssente(r.azione) },
      dettagli: r.letti,
      // «Persona: Mario Rossi» accanto all'autore Mario Rossi non aggiunge nulla
      oggetto: r.entita === "User" && r.userId && r.entitaId === r.userId ? null : oggettoDi({ entita: r.entita, entitaId: r.entitaId, dettagli: r.letti.dati }),
    })),
  };
}

export async function personePerFiltro() {
  return prisma.user.findMany({ where: { ruolo: { in: ["ADMIN", "COLLABORATORE"] } }, select: { id: true, nome: true, attivo: true }, orderBy: { nome: "asc" } });
}
