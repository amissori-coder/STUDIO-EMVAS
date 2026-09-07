"use server";
import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { promises as fs } from "node:fs";
import { AuthError, isAdmin, requireAdminAction, requireStaffAction, type CurrentUser } from "@/lib/auth/guards";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { audit } from "@/lib/audit";
import { CARTELLE_DEFAULT, RUOLI_STAFF } from "@/lib/constants";
import { deleteUpload, resolveUploadPath } from "@/lib/storage";
import { normalizeEmail } from "@/lib/utils";
import { canChangeReferente, canManagePortalAccess } from "./permessi";
import { contactSchema, parseClientForm, portalUserSchema, type ClientFieldErrors, type ClientFormValues } from "./validation";

// ---------------------------------------------------------------------------
// Tipi di stato per useActionState
// ---------------------------------------------------------------------------
export interface ClientFormState {
  error?: string;
  ok?: boolean;
  fieldErrors?: ClientFieldErrors;
  values?: ClientFormValues;
}

export interface SimpleState {
  error?: string;
  ok?: boolean;
  fieldErrors?: Record<string, string>;
  /** password generata/impostata, mostrata una sola volta */
  password?: string;
  /** contatore per distinguere invii successivi */
  nonce?: number;
}

function errorMessage(e: unknown, fallback: string) {
  if (e instanceof AuthError) return e.message;
  console.error(e);
  return fallback;
}

function firstErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  for (const [k, msgs] of Object.entries(flat)) if (msgs?.length) out[k] = msgs[0];
  return out;
}

function revalidateClient(clientId: string) {
  revalidatePath("/clienti");
  revalidatePath(`/clienti/${clientId}`);
  revalidatePath(`/clienti/${clientId}/modifica`);
}

async function validateReferente(referenteId: string | null) {
  if (!referenteId) return null;
  const u = await prisma.user.findFirst({ where: { id: referenteId, attivo: true, ruolo: { in: RUOLI_STAFF } }, select: { id: true } });
  return u ? u.id : undefined;
}

/** Password leggibile: lettere e cifre, 12 caratteri (senza caratteri ambigui). */
function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += alphabet[randomInt(alphabet.length)];
  // garantisce almeno una lettera e una cifra
  if (!/\d/.test(out)) out = out.slice(0, 11) + String(randomInt(10));
  if (!/[A-Za-z]/.test(out)) out = "a" + out.slice(1);
  return out;
}

// ---------------------------------------------------------------------------
// Cliente: crea / modifica / archivia / elimina
// ---------------------------------------------------------------------------
export async function createClientAction(_prev: ClientFormState, formData: FormData): Promise<ClientFormState> {
  let user: CurrentUser;
  try {
    user = await requireStaffAction();
  } catch (e) {
    return { error: errorMessage(e, "Operazione non consentita.") };
  }
  const { data, fieldErrors, values } = parseClientForm(formData);
  if (!data) return { error: "Controlla i campi evidenziati.", fieldErrors, values };

  const referenteId = await validateReferente(data.referenteId);
  if (referenteId === undefined) return { error: "Referente non valido.", fieldErrors: { referenteId: "Seleziona un collaboratore attivo." }, values };

  let id: string;
  try {
    const created = await prisma.client.create({
      data: {
        ...data,
        referenteId,
        cartelle: { create: CARTELLE_DEFAULT.map((c, i) => ({ nome: c.nome, descrizione: c.descrizione, ordine: i })) },
      },
      select: { id: true },
    });
    id = created.id;
    await audit({ userId: user.id, azione: "CLIENTE_CREATO", entita: "Client", entitaId: id, dettagli: { denominazione: data.denominazione } });
  } catch (e) {
    return { error: errorMessage(e, "Errore durante il salvataggio del cliente."), values };
  }
  revalidatePath("/clienti");
  redirect(`/clienti/${id}?messaggio=creato`);
}

export async function updateClientAction(clientId: string, _prev: ClientFormState, formData: FormData): Promise<ClientFormState> {
  let user: CurrentUser;
  try {
    user = await requireStaffAction();
  } catch (e) {
    return { error: errorMessage(e, "Operazione non consentita.") };
  }
  const { data, fieldErrors, values } = parseClientForm(formData);
  if (!data) return { error: "Controlla i campi evidenziati.", fieldErrors, values };

  try {
    const existing = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, attivo: true, referenteId: true } });
    if (!existing) return { error: "Cliente non trovato.", values };

    // Referente: se non cambia lo si conserva così com'è (anche se nel frattempo è stato disattivato);
    // se cambia serve l'autorizzazione (admin, referente attuale o cliente senza referente) e un collaboratore attivo.
    let referenteId: string | null = existing.referenteId;
    if (data.referenteId !== existing.referenteId) {
      if (!canChangeReferente(user, existing)) {
        return {
          error: "Solo un amministratore o il referente attuale può cambiare il referente del cliente.",
          fieldErrors: { referenteId: "Modifica non consentita." },
          values,
        };
      }
      const validato = await validateReferente(data.referenteId);
      if (validato === undefined) return { error: "Referente non valido.", fieldErrors: { referenteId: "Seleziona un collaboratore attivo." }, values };
      referenteId = validato;
    }

    // Solo gli amministratori possono cambiare lo stato attivo/archiviato
    const attivo = isAdmin(user) ? data.attivo : existing.attivo;
    await prisma.client.update({ where: { id: clientId }, data: { ...data, referenteId, attivo } });
    await audit({ userId: user.id, azione: "CLIENTE_MODIFICATO", entita: "Client", entitaId: clientId, dettagli: { denominazione: data.denominazione } });
  } catch (e) {
    return { error: errorMessage(e, "Errore durante il salvataggio del cliente."), values };
  }
  revalidateClient(clientId);
  redirect(`/clienti/${clientId}?messaggio=salvato`);
}

export async function setClientArchivedAction(clientId: string, archivia: boolean) {
  const user = await requireAdminAction();
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, denominazione: true } });
  if (!client) return;
  await prisma.client.update({ where: { id: clientId }, data: { attivo: !archivia } });
  await audit({
    userId: user.id,
    azione: archivia ? "CLIENTE_ARCHIVIATO" : "CLIENTE_RIATTIVATO",
    entita: "Client",
    entitaId: clientId,
    dettagli: { denominazione: client.denominazione },
  });
  revalidateClient(clientId);
  redirect(`/clienti/${clientId}?messaggio=${archivia ? "archiviato" : "riattivato"}`);
}

export async function deleteClientAction(clientId: string) {
  const user = await requireAdminAction();
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, denominazione: true, documenti: { select: { storagePath: true } } },
  });
  if (!client) return;
  await prisma.client.delete({ where: { id: clientId } });
  await audit({
    userId: user.id,
    azione: "CLIENTE_ELIMINATO",
    entita: "Client",
    entitaId: clientId,
    dettagli: { denominazione: client.denominazione, documenti: client.documenti.length },
  });
  // Rimuove i file dei documenti (le righe Document sono già cancellate in cascata) e la cartella uploads/<clientId>.
  for (const d of client.documenti) {
    try {
      await deleteUpload(d.storagePath);
    } catch (e) {
      console.error(`[clienti] impossibile eliminare il file ${d.storagePath}:`, e);
    }
  }
  try {
    await fs.rm(resolveUploadPath(client.id), { recursive: true, force: true });
  } catch (e) {
    console.error(`[clienti] impossibile eliminare la cartella uploads/${client.id}:`, e);
  }
  revalidatePath("/clienti");
  redirect("/clienti?messaggio=eliminato");
}

// ---------------------------------------------------------------------------
// Contatti
// ---------------------------------------------------------------------------
export async function saveContactAction(clientId: string, contactId: string | null, _prev: SimpleState, formData: FormData): Promise<SimpleState> {
  let user: CurrentUser;
  try {
    user = await requireStaffAction();
  } catch (e) {
    return { error: errorMessage(e, "Operazione non consentita.") };
  }
  const parsed = contactSchema.safeParse({
    nome: formData.get("nome") ?? "",
    email: formData.get("email") ?? "",
    telefono: formData.get("telefono") ?? "",
    ruolo: formData.get("ruolo") ?? "",
  });
  if (!parsed.success) return { error: "Controlla i campi evidenziati.", fieldErrors: firstErrors(parsed.error) };
  try {
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) return { error: "Cliente non trovato." };
    if (contactId) {
      const existing = await prisma.clientContact.findFirst({ where: { id: contactId, clientId }, select: { id: true } });
      if (!existing) return { error: "Contatto non trovato." };
      await prisma.clientContact.update({ where: { id: contactId }, data: parsed.data });
      await audit({ userId: user.id, azione: "CONTATTO_MODIFICATO", entita: "ClientContact", entitaId: contactId, dettagli: { clientId, nome: parsed.data.nome } });
    } else {
      const created = await prisma.clientContact.create({ data: { ...parsed.data, clientId } });
      await audit({ userId: user.id, azione: "CONTATTO_CREATO", entita: "ClientContact", entitaId: created.id, dettagli: { clientId, nome: parsed.data.nome } });
    }
  } catch (e) {
    return { error: errorMessage(e, "Errore durante il salvataggio del contatto.") };
  }
  revalidateClient(clientId);
  return { ok: true, nonce: Date.now() };
}

export async function deleteContactAction(clientId: string, contactId: string): Promise<SimpleState> {
  let user: CurrentUser;
  try {
    user = await requireStaffAction();
  } catch (e) {
    return { error: errorMessage(e, "Operazione non consentita.") };
  }
  try {
    const existing = await prisma.clientContact.findFirst({ where: { id: contactId, clientId }, select: { id: true, nome: true } });
    if (!existing) return { error: "Contatto non trovato." };
    await prisma.clientContact.delete({ where: { id: contactId } });
    await audit({ userId: user.id, azione: "CONTATTO_ELIMINATO", entita: "ClientContact", entitaId: contactId, dettagli: { clientId, nome: existing.nome } });
  } catch (e) {
    return { error: errorMessage(e, "Errore durante l'eliminazione del contatto.") };
  }
  revalidateClient(clientId);
  return { ok: true, nonce: Date.now() };
}

// ---------------------------------------------------------------------------
// Accesso al portale clienti (utenti con ruolo CLIENTE)
// ---------------------------------------------------------------------------
async function requireClientForPortal(clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, denominazione: true, referenteId: true } });
  if (!client) throw new AuthError("Cliente non trovato.", 404);
  return client;
}

/**
 * Carica il cliente e verifica che l'utente possa gestirne gli accessi al portale (admin o referente).
 * Un tentativo non autorizzato viene registrato in audit e rifiutato.
 */
async function requirePortalManager(user: CurrentUser, clientId: string, operazione: string) {
  const client = await requireClientForPortal(clientId);
  if (!canManagePortalAccess(user, client)) {
    await audit({ userId: user.id, azione: "ACCESSO_PORTALE_NEGATO", entita: "Client", entitaId: clientId, dettagli: { operazione } });
    throw new AuthError("Solo un amministratore o il referente del cliente può gestire gli accessi al portale.", 403);
  }
  return client;
}

export async function createPortalUserAction(clientId: string, _prev: SimpleState, formData: FormData): Promise<SimpleState> {
  let user: CurrentUser;
  try {
    user = await requireStaffAction();
  } catch (e) {
    return { error: errorMessage(e, "Operazione non consentita.") };
  }
  const parsed = portalUserSchema.safeParse({
    nome: formData.get("nome") ?? "",
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) return { error: "Controlla i campi evidenziati.", fieldErrors: firstErrors(parsed.error) };
  const password = parsed.data.password.trim() || generatePassword();
  const weak = validatePasswordStrength(password);
  if (weak) return { error: weak, fieldErrors: { password: weak } };

  try {
    const client = await requirePortalManager(user, clientId, "creazione");
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, ruolo: true } });
    if (existing) {
      return {
        error:
          existing.ruolo === "CLIENTE"
            ? "Esiste già un utente con questa email: usa «Collega utente esistente»."
            : "Questa email appartiene a un utente dello studio.",
        fieldErrors: { email: "Email già in uso." },
      };
    }
    const created = await prisma.user.create({
      data: {
        email: parsed.data.email,
        nome: parsed.data.nome,
        ruolo: "CLIENTE",
        passwordHash: await hashPassword(password),
        colore: "#64748b",
        accessiClienti: { create: { clientId } },
      },
      select: { id: true },
    });
    await audit({
      userId: user.id,
      azione: "UTENTE_PORTALE_CREATO",
      entita: "User",
      entitaId: created.id,
      dettagli: { clientId, denominazione: client.denominazione, email: parsed.data.email },
    });
  } catch (e) {
    return { error: errorMessage(e, "Errore durante la creazione dell'utente.") };
  }
  revalidateClient(clientId);
  return { ok: true, password, nonce: Date.now() };
}

export async function linkPortalUserAction(clientId: string, _prev: SimpleState, formData: FormData): Promise<SimpleState> {
  let user: CurrentUser;
  try {
    user = await requireStaffAction();
  } catch (e) {
    return { error: errorMessage(e, "Operazione non consentita.") };
  }
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return { error: "Inserisci l'email dell'utente da collegare.", fieldErrors: { email: "Campo obbligatorio." } };
  try {
    const client = await requirePortalManager(user, clientId, "collegamento");
    const target = await prisma.user.findUnique({ where: { email }, select: { id: true, ruolo: true, nome: true } });
    if (!target || target.ruolo !== "CLIENTE") return { error: "Nessun utente del portale con questa email.", fieldErrors: { email: "Utente non trovato." } };
    const already = await prisma.clientUser.findUnique({ where: { userId_clientId: { userId: target.id, clientId } } });
    if (already) return { error: "L'utente è già collegato a questo cliente." };
    await prisma.clientUser.create({ data: { userId: target.id, clientId } });
    await audit({
      userId: user.id,
      azione: "UTENTE_PORTALE_COLLEGATO",
      entita: "User",
      entitaId: target.id,
      dettagli: { clientId, denominazione: client.denominazione, email },
    });
  } catch (e) {
    return { error: errorMessage(e, "Errore durante il collegamento dell'utente.") };
  }
  revalidateClient(clientId);
  return { ok: true, nonce: Date.now() };
}

export async function resetPortalPasswordAction(clientId: string, userId: string, _prev: SimpleState, formData: FormData): Promise<SimpleState> {
  let user: CurrentUser;
  try {
    user = await requireStaffAction();
  } catch (e) {
    return { error: errorMessage(e, "Operazione non consentita.") };
  }
  const typed = String(formData.get("password") ?? "").trim();
  const password = typed || generatePassword();
  const weak = validatePasswordStrength(password);
  if (weak) return { error: weak, fieldErrors: { password: weak } };
  try {
    await requirePortalManager(user, clientId, "reset-password");
    const link = await prisma.clientUser.findUnique({ where: { userId_clientId: { userId, clientId } }, include: { user: { select: { ruolo: true } } } });
    if (!link || link.user.ruolo !== "CLIENTE") return { error: "Utente non collegato a questo cliente." };
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 } } });
    await audit({ userId: user.id, azione: "UTENTE_PORTALE_PASSWORD_RESET", entita: "User", entitaId: userId, dettagli: { clientId } });
  } catch (e) {
    return { error: errorMessage(e, "Errore durante la reimpostazione della password.") };
  }
  revalidateClient(clientId);
  return { ok: true, password, nonce: Date.now() };
}

export async function setPortalUserActiveAction(clientId: string, userId: string, attivo: boolean): Promise<SimpleState> {
  let user: CurrentUser;
  try {
    user = await requireStaffAction();
  } catch (e) {
    return { error: errorMessage(e, "Operazione non consentita.") };
  }
  try {
    await requirePortalManager(user, clientId, attivo ? "attivazione" : "disattivazione");
    const link = await prisma.clientUser.findUnique({ where: { userId_clientId: { userId, clientId } }, include: { user: { select: { ruolo: true } } } });
    if (!link || link.user.ruolo !== "CLIENTE") return { error: "Utente non collegato a questo cliente." };
    await prisma.user.update({ where: { id: userId }, data: { attivo } });
    await audit({ userId: user.id, azione: attivo ? "UTENTE_PORTALE_ATTIVATO" : "UTENTE_PORTALE_DISATTIVATO", entita: "User", entitaId: userId, dettagli: { clientId } });
  } catch (e) {
    return { error: errorMessage(e, "Errore durante l'aggiornamento dell'utente.") };
  }
  revalidateClient(clientId);
  return { ok: true, nonce: Date.now() };
}

export async function unlinkPortalUserAction(clientId: string, userId: string): Promise<SimpleState> {
  let user: CurrentUser;
  try {
    user = await requireStaffAction();
  } catch (e) {
    return { error: errorMessage(e, "Operazione non consentita.") };
  }
  try {
    await requirePortalManager(user, clientId, "scollegamento");
    const link = await prisma.clientUser.findUnique({ where: { userId_clientId: { userId, clientId } } });
    if (!link) return { error: "Utente non collegato a questo cliente." };
    await prisma.clientUser.delete({ where: { id: link.id } });
    await audit({ userId: user.id, azione: "UTENTE_PORTALE_SCOLLEGATO", entita: "User", entitaId: userId, dettagli: { clientId } });
  } catch (e) {
    return { error: errorMessage(e, "Errore durante lo scollegamento dell'utente.") };
  }
  revalidateClient(clientId);
  return { ok: true, nonce: Date.now() };
}
