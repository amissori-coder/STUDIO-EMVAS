"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { AuthError, requireAdminAction } from "@/lib/auth/guards";
import { CATEGORIE_ADEMPIMENTO, REGIMI_FISCALI, RICORRENZE, TIPI_SOGGETTO } from "@/lib/constants";
import { pianificaAnno } from "@/lib/adempimenti/engine";
import type { ScadenzaRegola } from "@/lib/adempimenti/catalogo";

export interface TemplateActionResult {
  ok?: boolean;
  error?: string;
}

const CATEGORIE = Object.keys(CATEGORIE_ADEMPIMENTO) as [string, ...string[]];
const RICORRENZE_KEYS = Object.keys(RICORRENZE) as [string, ...string[]];
const REGIMI_KEYS = Object.keys(REGIMI_FISCALI);
const TIPI_KEYS = Object.keys(TIPI_SOGGETTO);

const scadenzaMensileSchema = z.object({
  giorno: z.number().int().min(0).max(31),
  offsetMeseCompetenza: z.number().int().min(-12).max(12).optional(),
});
const scadenzaFissaSchema = z.object({
  mese: z.number().int().min(1).max(12),
  giorno: z.number().int().min(0).max(31),
  etichetta: z.string().trim().max(80).optional(),
});

const templateSchema = z.object({
  codice: z
    .string()
    .trim()
    .min(2, "Inserisci un codice (es. IVA_LIQ_MENSILE).")
    .max(60, "Codice troppo lungo.")
    .regex(/^[A-Z0-9_]+$/, "Il codice può contenere solo lettere maiuscole, numeri e trattino basso."),
  nome: z.string().trim().min(2, "Inserisci il nome dell'adempimento.").max(200, "Nome troppo lungo."),
  descrizione: z.string().trim().max(2000, "Descrizione troppo lunga.").optional(),
  categoria: z.enum(CATEGORIE, { error: "Categoria non valida." }),
  ricorrenza: z.enum(RICORRENZE_KEYS, { error: "Ricorrenza non valida." }),
  scadenze: z.string(),
  regimi: z.array(z.string()),
  tipiSoggetto: z.array(z.string()),
  soloConDipendenti: z.enum(["", "si", "no"]),
  soloConIva: z.enum(["", "si", "no"]),
  periodicitaIva: z.enum(["", "MENSILE", "TRIMESTRALE"]),
  soloSuRichiesta: z.boolean(),
  giorniPreavviso: z.coerce.number().int().min(0, "Preavviso non valido.").max(365, "Preavviso non valido."),
  attivo: z.boolean(),
  ordine: z.coerce.number().int().min(0).max(9999),
});

function fd(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function triStato(v: "" | "si" | "no") {
  return v === "" ? null : v === "si";
}

function erroreUtente(e: unknown): TemplateActionResult {
  if (e instanceof AuthError) return { error: e.message };
  console.error("[adempimenti] errore action:", e);
  return { error: "Si è verificato un errore imprevisto. Riprova." };
}

/** Valida e normalizza le scadenze inviate dall'editor (JSON) in base alla ricorrenza. */
function validaScadenze(ricorrenza: string, json: string): { scadenze: ScadenzaRegola[] } | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json || "[]");
  } catch {
    return { error: "Formato scadenze non valido." };
  }
  if (!Array.isArray(raw)) return { error: "Formato scadenze non valido." };
  if (ricorrenza === "UNA_TANTUM") return { scadenze: [] };
  if (ricorrenza === "MENSILE") {
    const p = scadenzaMensileSchema.safeParse(raw[0] ?? { giorno: 16, offsetMeseCompetenza: -1 });
    if (!p.success) return { error: "Regola mensile non valida: indica un giorno tra 0 (ultimo del mese) e 31." };
    return { scadenze: [p.data] };
  }
  const p = z.array(scadenzaFissaSchema).min(1, "Inserisci almeno una scadenza.").max(24).safeParse(raw);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Scadenze non valide: controlla mese e giorno di ogni riga." };
  return { scadenze: p.data.map((s) => ({ mese: s.mese, giorno: s.giorno, ...(s.etichetta ? { etichetta: s.etichetta } : {}) })) };
}

function leggiForm(formData: FormData) {
  return templateSchema.safeParse({
    codice: fd(formData, "codice").toUpperCase(),
    nome: fd(formData, "nome"),
    descrizione: fd(formData, "descrizione"),
    categoria: fd(formData, "categoria"),
    ricorrenza: fd(formData, "ricorrenza"),
    scadenze: fd(formData, "scadenze"),
    regimi: formData.getAll("regimi").filter((v): v is string => typeof v === "string" && REGIMI_KEYS.includes(v)),
    tipiSoggetto: formData.getAll("tipiSoggetto").filter((v): v is string => typeof v === "string" && TIPI_KEYS.includes(v)),
    soloConDipendenti: fd(formData, "soloConDipendenti"),
    soloConIva: fd(formData, "soloConIva"),
    periodicitaIva: fd(formData, "periodicitaIva"),
    soloSuRichiesta: formData.get("soloSuRichiesta") === "on",
    giorniPreavviso: fd(formData, "giorniPreavviso") || "7",
    attivo: formData.get("attivo") === "on",
    ordine: fd(formData, "ordine") || "0",
  });
}

export async function salvaTemplate(_prev: TemplateActionResult, formData: FormData): Promise<TemplateActionResult> {
  let destinazione = "/adempimenti";
  try {
    const user = await requireAdminAction();
    const id = fd(formData, "id") || null;
    const parsed = leggiForm(formData);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
    const d = parsed.data;
    const sc = validaScadenze(d.ricorrenza, d.scadenze);
    if ("error" in sc) return { error: sc.error };

    const duplicato = await prisma.adempimentoTemplate.findUnique({ where: { codice: d.codice }, select: { id: true } });
    if (duplicato && duplicato.id !== id) return { error: `Esiste già un adempimento con codice ${d.codice}.` };

    const data = {
      codice: d.codice,
      nome: d.nome,
      descrizione: d.descrizione || null,
      categoria: d.categoria,
      ricorrenza: d.ricorrenza,
      scadenze: JSON.stringify(sc.scadenze),
      regimi: JSON.stringify(d.regimi),
      tipiSoggetto: JSON.stringify(d.tipiSoggetto),
      soloConDipendenti: triStato(d.soloConDipendenti),
      soloConIva: triStato(d.soloConIva),
      periodicitaIva: d.periodicitaIva || null,
      soloSuRichiesta: d.soloSuRichiesta,
      giorniPreavviso: d.giorniPreavviso,
      attivo: d.attivo,
      ordine: d.ordine,
    };

    if (id) {
      const esistente = await prisma.adempimentoTemplate.findUnique({ where: { id }, select: { id: true } });
      if (!esistente) return { error: "Adempimento non trovato." };
      await prisma.adempimentoTemplate.update({ where: { id }, data });
      await audit({ userId: user.id, azione: "TEMPLATE_MODIFICATO", entita: "AdempimentoTemplate", entitaId: id, dettagli: { codice: d.codice, nome: d.nome } });
    } else {
      const creato = await prisma.adempimentoTemplate.create({ data });
      await audit({ userId: user.id, azione: "TEMPLATE_CREATO", entita: "AdempimentoTemplate", entitaId: creato.id, dettagli: { codice: d.codice, nome: d.nome } });
    }
    revalidatePath("/adempimenti");
    revalidatePath("/attivita/nuova");
    destinazione = `/adempimenti?salvato=${encodeURIComponent(d.codice)}#${d.categoria}`;
  } catch (e) {
    return erroreUtente(e);
  }
  redirect(destinazione);
}

export async function eliminaTemplate(formData: FormData) {
  const user = await requireAdminAction();
  const id = fd(formData, "id");
  const t = await prisma.adempimentoTemplate.findUnique({ where: { id }, select: { id: true, codice: true, nome: true } });
  if (!t) throw new AuthError("Adempimento non trovato.", 404);
  await prisma.adempimentoTemplate.delete({ where: { id } });
  await audit({ userId: user.id, azione: "TEMPLATE_ELIMINATO", entita: "AdempimentoTemplate", entitaId: id, dettagli: { codice: t.codice, nome: t.nome } });
  revalidatePath("/adempimenti");
  revalidatePath("/attivita/nuova");
  redirect("/adempimenti");
}

export async function toggleTemplateAttivo(formData: FormData) {
  const user = await requireAdminAction();
  const id = fd(formData, "id");
  const t = await prisma.adempimentoTemplate.findUnique({ where: { id }, select: { id: true, attivo: true, nome: true } });
  if (!t) throw new AuthError("Adempimento non trovato.", 404);
  await prisma.adempimentoTemplate.update({ where: { id }, data: { attivo: !t.attivo } });
  await audit({ userId: user.id, azione: "TEMPLATE_MODIFICATO", entita: "AdempimentoTemplate", entitaId: id, dettagli: { nome: t.nome, attivo: !t.attivo } });
  revalidatePath("/adempimenti");
}

// ---------------------------------------------------------------------------
// Pianificazione massiva
// ---------------------------------------------------------------------------

export interface RigaPianificazioneMassiva {
  clientId: string;
  denominazione: string;
  creati: number;
  esistenti: number;
  errore?: string;
}

export interface PianificazioneMassivaResult {
  ok?: boolean;
  error?: string;
  anno?: number;
  righe?: RigaPianificazioneMassiva[];
  totaleCreati?: number;
  totaleEsistenti?: number;
}

export async function pianificazioneMassiva(_prev: PianificazioneMassivaResult, formData: FormData): Promise<PianificazioneMassivaResult> {
  try {
    const user = await requireAdminAction();
    const anno = z.coerce.number().int().min(2000).max(2100).safeParse(fd(formData, "anno"));
    if (!anno.success) return { error: "Anno non valido." };
    const saltaPassate = formData.get("saltaPassate") === "on";
    const clienti = await prisma.client.findMany({ where: { attivo: true }, select: { id: true, denominazione: true, referenteId: true }, orderBy: { denominazione: "asc" } });
    if (clienti.length === 0) return { error: "Non ci sono clienti attivi da pianificare." };

    const righe: RigaPianificazioneMassiva[] = [];
    const perReferente = new Map<string, number>();
    for (const c of clienti) {
      try {
        const r = await pianificaAnno({ clientId: c.id, anno: anno.data, createdById: user.id, saltaPassate });
        righe.push({ clientId: c.id, denominazione: c.denominazione, ...r });
        if (r.creati > 0 && c.referenteId && c.referenteId !== user.id) perReferente.set(c.referenteId, (perReferente.get(c.referenteId) ?? 0) + r.creati);
      } catch (e) {
        console.error("[adempimenti] pianificazione fallita per", c.denominazione, e);
        righe.push({ clientId: c.id, denominazione: c.denominazione, creati: 0, esistenti: 0, errore: "Errore durante la generazione." });
      }
    }
    const totaleCreati = righe.reduce((s, r) => s + r.creati, 0);
    const totaleEsistenti = righe.reduce((s, r) => s + r.esistenti, 0);
    await audit({ userId: user.id, azione: "PIANIFICAZIONE_MASSIVA", entita: "AdempimentoTemplate", dettagli: { anno: anno.data, saltaPassate, clienti: clienti.length, totaleCreati, totaleEsistenti } });
    for (const [referenteId, n] of perReferente) {
      await notify({
        userId: referenteId,
        tipo: "ATTIVITA_ASSEGNATA",
        titolo: `${n} nuove attività assegnate dalla pianificazione ${anno.data}`,
        corpo: `${user.nome} ha pianificato gli adempimenti ${anno.data} per i clienti di cui sei referente.`,
        link: `/attivita?assegnatario=${referenteId}&stato=aperte&ordina=scadenza`,
      });
    }
    revalidatePath("/attivita");
    revalidatePath("/scadenzario");
    revalidatePath("/dashboard");
    revalidatePath("/adempimenti");
    revalidatePath("/clienti");
    return { ok: true, anno: anno.data, righe, totaleCreati, totaleEsistenti };
  } catch (e) {
    return erroreUtente(e);
  }
}
