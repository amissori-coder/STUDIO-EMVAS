"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuthError, requireAdminAction, requireStaffAction } from "@/lib/auth/guards";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit";
import { syncGoogleAccount } from "@/lib/gmail";
import { eseguiJobGiornalieri } from "@/lib/cron/jobs";
import { isPushConfigured, notify } from "@/lib/notifications";

export interface ImpostazioniState {
  error?: string;
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** risultato strutturato (sincronizzazione Gmail, job) */
  result?: Record<string, unknown>;
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

function revalidateImpostazioni() {
  revalidatePath("/impostazioni");
  revalidatePath("/team");
}

// ---------------------------------------------------------------------------
// Profilo
// ---------------------------------------------------------------------------
const profiloSchema = z.object({
  nome: z.string().trim().min(2, "Inserisci il nome.").max(120, "Nome troppo lungo."),
  telefono: z.string().trim().max(40, "Telefono troppo lungo.").optional().or(z.literal("")),
  colore: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Colore non valido."),
});

export async function updateProfileAction(_prev: ImpostazioniState, formData: FormData): Promise<ImpostazioniState> {
  try {
    const user = await requireStaffAction();
    const parsed = profiloSchema.safeParse({ nome: formData.get("nome"), telefono: formData.get("telefono") ?? "", colore: formData.get("colore") });
    if (!parsed.success) return { error: "Controlla i campi evidenziati.", fieldErrors: firstErrors(parsed.error) };
    await prisma.user.update({ where: { id: user.id }, data: { nome: parsed.data.nome, telefono: parsed.data.telefono || null, colore: parsed.data.colore } });
    await audit({ userId: user.id, azione: "PROFILO_MODIFICATO", entita: "User", entitaId: user.id, dettagli: parsed.data });
    revalidateImpostazioni();
    revalidatePath("/", "layout");
    return { ok: true, message: "Profilo aggiornato.", nonce: Date.now() };
  } catch (e) {
    return { error: errorMessage(e, "Errore durante il salvataggio del profilo.") };
  }
}

// ---------------------------------------------------------------------------
// Password
// ---------------------------------------------------------------------------
export async function changePasswordAction(_prev: ImpostazioniState, formData: FormData): Promise<ImpostazioniState> {
  try {
    const user = await requireStaffAction();
    const attuale = String(formData.get("attuale") ?? "");
    const nuova = String(formData.get("nuova") ?? "");
    const conferma = String(formData.get("conferma") ?? "");
    const db = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    if (!db) return { error: "Utente non trovato." };
    if (db.passwordHash) {
      if (!attuale) return { error: "Inserisci la password attuale.", fieldErrors: { attuale: "Obbligatoria." } };
      if (!(await verifyPassword(attuale, db.passwordHash))) return { error: "La password attuale non è corretta.", fieldErrors: { attuale: "Password errata." } };
    }
    const weak = validatePasswordStrength(nuova);
    if (weak) return { error: weak, fieldErrors: { nuova: weak } };
    if (nuova !== conferma) return { error: "Le due password non coincidono.", fieldErrors: { conferma: "Non coincide con la nuova password." } };
    if (db.passwordHash && (await verifyPassword(nuova, db.passwordHash))) return { error: "La nuova password deve essere diversa da quella attuale.", fieldErrors: { nuova: "Uguale alla password attuale." } };
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(nuova), inviteToken: null, inviteExpires: null } });
    await audit({ userId: user.id, azione: "PASSWORD_CAMBIATA", entita: "User", entitaId: user.id });
    return { ok: true, message: "Password aggiornata.", nonce: Date.now() };
  } catch (e) {
    return { error: errorMessage(e, "Errore durante il cambio password.") };
  }
}

// ---------------------------------------------------------------------------
// Preferenze notifiche
// ---------------------------------------------------------------------------
export async function updateNotificationPrefsAction(_prev: ImpostazioniState, formData: FormData): Promise<ImpostazioniState> {
  try {
    const user = await requireStaffAction();
    const notificaEmail = formData.get("notificaEmail") === "on";
    const notificaPush = formData.get("notificaPush") === "on";
    await prisma.user.update({ where: { id: user.id }, data: { notificaEmail, notificaPush } });
    await audit({ userId: user.id, azione: "PREFERENZE_NOTIFICHE", entita: "User", entitaId: user.id, dettagli: { notificaEmail, notificaPush } });
    revalidateImpostazioni();
    return { ok: true, message: "Preferenze salvate.", nonce: Date.now() };
  } catch (e) {
    return { error: errorMessage(e, "Errore durante il salvataggio delle preferenze.") };
  }
}

// ---------------------------------------------------------------------------
// Gmail
// ---------------------------------------------------------------------------
export async function syncGmailAction(): Promise<ImpostazioniState> {
  try {
    const user = await requireStaffAction();
    const account = await prisma.googleAccount.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!account) return { error: "Nessun account Gmail collegato." };
    const r = await syncGoogleAccount(account.id);
    revalidateImpostazioni();
    revalidatePath("/email");
    if (r.error) return { error: `Sincronizzazione fallita: ${r.error}`, result: { ...r } };
    return {
      ok: true,
      message: `Sincronizzazione completata: ${r.imported} ${r.imported === 1 ? "email importata" : "email importate"}, ${r.linked} ${r.linked === 1 ? "associata" : "associate"} a clienti, ${r.skipped} ignorate.`,
      result: { ...r },
      nonce: Date.now(),
    };
  } catch (e) {
    return { error: errorMessage(e, "Errore durante la sincronizzazione.") };
  }
}

export async function disconnectGmailAction(): Promise<ImpostazioniState> {
  try {
    const user = await requireStaffAction();
    const account = await prisma.googleAccount.findUnique({ where: { userId: user.id }, select: { id: true, googleEmail: true, _count: { select: { emails: true } } } });
    if (!account) return { error: "Nessun account Gmail collegato." };
    await prisma.googleAccount.delete({ where: { id: account.id } });
    await audit({ userId: user.id, azione: "GMAIL_SCOLLEGATO", entita: "GoogleAccount", entitaId: account.id, dettagli: { googleEmail: account.googleEmail, emailRimosse: account._count.emails } });
    revalidateImpostazioni();
    revalidatePath("/email");
    revalidatePath("/", "layout");
    return { ok: true, message: `Account ${account.googleEmail} scollegato. Rimosse ${account._count.emails} email importate.`, nonce: Date.now() };
  } catch (e) {
    return { error: errorMessage(e, "Errore durante lo scollegamento dell'account.") };
  }
}

// ---------------------------------------------------------------------------
// Amministrazione
// ---------------------------------------------------------------------------
export async function runDailyJobsAction(): Promise<ImpostazioniState> {
  try {
    const admin = await requireAdminAction();
    const r = await eseguiJobGiornalieri();
    await audit({ userId: admin.id, azione: "JOB_GIORNALIERI_MANUALI", entita: "Sistema", dettagli: r });
    revalidatePath("/notifiche");
    revalidatePath("/dashboard");
    return { ok: true, message: "Job giornalieri eseguiti.", result: r, nonce: Date.now() };
  } catch (e) {
    return { error: errorMessage(e, "Errore durante l'esecuzione dei job.") };
  }
}

export async function sendTestNotificationAction(): Promise<ImpostazioniState> {
  try {
    const admin = await requireAdminAction();
    const subs = await prisma.pushSubscription.count({ where: { userId: admin.id } });
    await notify({
      userId: admin.id,
      tipo: "SISTEMA",
      titolo: "Notifica di prova",
      corpo: `Inviata da Impostazioni alle ${new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}. Se la vedi anche come push, tutto funziona.`,
      link: "/impostazioni",
      push: true,
    });
    revalidatePath("/notifiche");
    const push = !isPushConfigured() ? "Push non configurato sul server." : subs === 0 ? "Nessun dispositivo registrato per il push: attivalo qui sotto." : `Push inviato a ${subs} ${subs === 1 ? "dispositivo" : "dispositivi"}.`;
    return { ok: true, message: `Notifica creata (la trovi in Notifiche). ${push}`, nonce: Date.now() };
  } catch (e) {
    return { error: errorMessage(e, "Errore durante l'invio della notifica di prova.") };
  }
}
