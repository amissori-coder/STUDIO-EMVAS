"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { AuthError, requireAdminAction, requireStaffAction } from "@/lib/auth/guards";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { checkRateLimit, recordAttempt, resetRateLimit } from "@/lib/auth/rate-limit";
import { generaCodiciRecupero, generaSegreto, impronta, verificaTotp } from "@/lib/auth/totp";
import { MESSAGGI_CODICE, verificaCodiceUtente } from "@/lib/auth/verifica-codice";
import { notify } from "@/lib/notifications";
import { RUOLI_STAFF } from "@/lib/constants";

export interface DuePassaggiState {
  error?: string;
  message?: string;
  /** codici di recupero appena generati: si mostrano una volta sola */
  codici?: string[];
  nonce?: number;
}

const QUINDICI_MINUTI = 15 * 60 * 1000;
const MAX_ERRORI = 5;

/** Campi da azzerare quando la verifica si spegne (dall'utente o da un amministratore). */
const SPENTA = { totpAttivo: false, totpSecret: null, totpRecupero: null, totpConfermato: null, totpUltimoPasso: null } as const;

function errore(e: unknown): DuePassaggiState {
  if (e instanceof AuthError) return { error: e.message };
  console.error(e);
  return { error: "Operazione non riuscita. Riprova." };
}

function limite(chiave: string): string | null {
  const r = checkRateLimit(chiave, MAX_ERRORI, QUINDICI_MINUTI);
  if (r.ok) return null;
  const m = Math.max(1, Math.ceil(r.retryAfterSec / 60));
  return `Troppi tentativi errati. Riprova tra ${m === 1 ? "1 minuto" : `${m} minuti`}.`;
}

/** Primo passo dell'attivazione: un nuovo segreto, non ancora richiesto all'accesso. */
export async function avviaConfigurazioneAction(): Promise<DuePassaggiState> {
  try {
    const user = await requireStaffAction();
    // la condizione sul campo impedisce di sostituire il segreto di una verifica già attiva
    const r = await prisma.user.updateMany({ where: { id: user.id, totpAttivo: false }, data: { totpSecret: generaSegreto(), totpUltimoPasso: null } });
    if (r.count === 0) return { error: "La verifica in due passaggi è già attiva." };
    revalidatePath("/impostazioni");
    return {};
  } catch (e) {
    return errore(e);
  }
}

export async function annullaConfigurazioneAction(): Promise<DuePassaggiState> {
  try {
    const user = await requireStaffAction();
    await prisma.user.updateMany({ where: { id: user.id, totpAttivo: false }, data: { totpSecret: null } });
    revalidatePath("/impostazioni");
    return {};
  } catch (e) {
    return errore(e);
  }
}

/**
 * Conferma con il primo codice letto dall'app: solo ora la verifica diventa obbligatoria. Le sessioni
 * aperte su altri dispositivi (entrate senza codice) vengono chiuse; questa resta aperta.
 */
export async function confermaConfigurazioneAction(_prev: DuePassaggiState, formData: FormData): Promise<DuePassaggiState> {
  try {
    const user = await requireStaffAction();
    const chiave = `totp:conferma:${user.id}`;
    const bloccato = limite(chiave);
    if (bloccato) return { error: bloccato };
    const db = await prisma.user.findUnique({ where: { id: user.id }, select: { totpSecret: true, totpAttivo: true } });
    if (db?.totpAttivo) return { error: "La verifica in due passaggi è già attiva." };
    if (!db?.totpSecret) return { error: "La configurazione è stata annullata: ricomincia da «Attiva»." };
    const v = verificaTotp(db.totpSecret, String(formData.get("codice") ?? ""));
    if (!v.ok) {
      if (v.motivo === "errato") recordAttempt(chiave, QUINDICI_MINUTI);
      return { error: MESSAGGI_CODICE[v.motivo] };
    }
    const codici = generaCodiciRecupero();
    const attivata = await prisma.user.updateMany({
      // lo stesso segreto letto sopra: se nel frattempo la configurazione è ripartita, il codice non vale
      where: { id: user.id, totpAttivo: false, totpSecret: db.totpSecret },
      data: {
        totpAttivo: true,
        totpConfermato: new Date(),
        totpUltimoPasso: v.passo,
        totpRecupero: codici.map(impronta).join(","),
        sessionVersion: { increment: 1 },
      },
    });
    if (attivata.count === 0) return { error: "La configurazione è cambiata nel frattempo: ricarica la pagina e riprova." };
    resetRateLimit(chiave);
    const { sessionVersion } = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { sessionVersion: true } });
    await createSession({ sub: user.id, email: user.email, nome: user.nome, ruolo: user.ruolo, sv: sessionVersion });
    await audit({ userId: user.id, azione: "TOTP_ATTIVATA", entita: "User", entitaId: user.id });
    revalidatePath("/impostazioni");
    revalidatePath("/team");
    return { codici, message: "Verifica in due passaggi attivata. Gli altri dispositivi dovranno accedere di nuovo con il codice.", nonce: Date.now() };
  } catch (e) {
    return errore(e);
  }
}

/** Nuovi codici di recupero (i vecchi smettono di valere): richiede il codice dell'app. */
export async function rigeneraCodiciAction(_prev: DuePassaggiState, formData: FormData): Promise<DuePassaggiState> {
  try {
    const user = await requireStaffAction();
    const chiave = `totp:gestione:${user.id}`;
    const bloccato = limite(chiave);
    if (bloccato) return { error: bloccato };
    const esito = await verificaCodiceUtente(user.id, String(formData.get("codice") ?? ""), { recupero: false });
    if (!esito.ok) {
      if (esito.motivo === "errato") recordAttempt(chiave, QUINDICI_MINUTI);
      return { error: MESSAGGI_CODICE[esito.motivo] };
    }
    const codici = generaCodiciRecupero();
    await prisma.user.update({ where: { id: user.id }, data: { totpRecupero: codici.map(impronta).join(",") } });
    resetRateLimit(chiave);
    await audit({ userId: user.id, azione: "TOTP_CODICI_RIGENERATI", entita: "User", entitaId: user.id });
    revalidatePath("/impostazioni");
    return { codici, message: "Nuovi codici di recupero generati: quelli precedenti non valgono più.", nonce: Date.now() };
  } catch (e) {
    return errore(e);
  }
}

/**
 * Disattivazione: password (se l'account ne ha una) e codice, dell'app o di recupero. Con il solo
 * telefono rubato o la sola sessione lasciata aperta non si spegne la protezione.
 */
export async function disattivaAction(_prev: DuePassaggiState, formData: FormData): Promise<DuePassaggiState> {
  try {
    const user = await requireStaffAction();
    const chiave = `totp:gestione:${user.id}`;
    const bloccato = limite(chiave);
    if (bloccato) return { error: bloccato };
    const db = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true, totpAttivo: true } });
    if (!db?.totpAttivo) return { error: "La verifica in due passaggi non è attiva." };
    if (db.passwordHash && !(await verifyPassword(String(formData.get("password") ?? ""), db.passwordHash))) {
      recordAttempt(chiave, QUINDICI_MINUTI);
      return { error: "La password non è corretta." };
    }
    const esito = await verificaCodiceUtente(user.id, String(formData.get("codice") ?? ""), { recupero: true });
    if (!esito.ok) {
      if (esito.motivo === "errato") recordAttempt(chiave, QUINDICI_MINUTI);
      return { error: MESSAGGI_CODICE[esito.motivo] };
    }
    await prisma.user.update({ where: { id: user.id }, data: SPENTA });
    resetRateLimit(chiave);
    await audit({ userId: user.id, azione: "TOTP_DISATTIVATA", entita: "User", entitaId: user.id, dettagli: { con: esito.tipo === "recupero" ? "codice di recupero" : "codice dell'app" } });
    revalidatePath("/impostazioni");
    revalidatePath("/team");
    return { message: "Verifica in due passaggi disattivata: da ora per entrare basta la password. Puoi riattivarla quando vuoi.", nonce: Date.now() };
  } catch (e) {
    return errore(e);
  }
}

/**
 * Un amministratore azzera la verifica di un collega che ha perso il telefono e i codici di recupero.
 * La persona viene disconnessa ovunque e avvisata; al prossimo accesso basterà la password.
 */
export async function azzeraDuePassaggiAction(userId: string): Promise<DuePassaggiState> {
  try {
    const admin = await requireAdminAction();
    const id = z.string().min(1).parse(userId);
    if (id === admin.id) return { error: "Non puoi azzerare la tua verifica da qui: usa Impostazioni, con il codice o un codice di recupero." };
    const target = await prisma.user.findFirst({ where: { id, ruolo: { in: RUOLI_STAFF } }, select: { id: true, nome: true, email: true, totpAttivo: true } });
    if (!target) return { error: "Collaboratore non trovato." };
    if (!target.totpAttivo) return { error: `${target.nome} non ha la verifica in due passaggi attiva.` };
    await prisma.user.update({ where: { id }, data: { ...SPENTA, sessionVersion: { increment: 1 } } });
    await audit({ userId: admin.id, azione: "TOTP_AZZERATA_DA_ADMIN", entita: "User", entitaId: id, dettagli: { nome: target.nome, email: target.email } });
    await notify({
      userId: id,
      tipo: "SISTEMA",
      titolo: "Verifica in due passaggi azzerata",
      corpo: `${admin.nome} ha azzerato la verifica in due passaggi del tuo account. Accedi con la password e riattivala da Impostazioni.`,
      link: "/impostazioni#verifica-due-passaggi",
      email: true,
    });
    revalidatePath("/team");
    return { message: `Verifica in due passaggi di ${target.nome} azzerata: ora si accede con la sola password e la persona ha ricevuto un avviso.`, nonce: Date.now() };
  } catch (e) {
    return errore(e);
  }
}
