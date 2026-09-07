"use server";
import { randomBytes, randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuthError, requireAdminAction, requireStaffAction, type CurrentUser } from "@/lib/auth/guards";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { isMailerConfigured, sendEmail } from "@/lib/mailer";
import { appUrl, notify, notifyAdmins } from "@/lib/notifications";
import { COLORI_UTENTE, RUOLI_STAFF, STATI_ASSENZA, TIPI_ASSENZA, TIPI_NOTIFICA, type Ruolo } from "@/lib/constants";
import { formatDate, normalizeEmail, parseDateInput } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tipi di stato
// ---------------------------------------------------------------------------
export interface TeamActionState {
  error?: string;
  ok?: boolean;
  fieldErrors?: Record<string, string>;
  /** link di invito (mostrato dopo la creazione / reinvio) */
  inviteLink?: string;
  /** true se l'invito è stato inviato anche via email */
  emailSent?: boolean;
  /** password temporanea impostata, mostrata una sola volta */
  password?: string;
  /** avviso non bloccante (es. sovrapposizione assenze) */
  warning?: string;
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

const INVITE_DAYS = 7;

function revalidateTeam() {
  revalidatePath("/team");
  revalidatePath("/team/assenze");
  revalidatePath("/dashboard");
}

function nuovoInvito() {
  return { inviteToken: randomBytes(32).toString("hex"), inviteExpires: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000) };
}

async function inviaEmailInvito(opts: { to: string; nome: string; link: string; invitante: string }) {
  if (!isMailerConfigured()) return false;
  return sendEmail({
    to: opts.to,
    subject: "Invito a Studio EMVAS",
    text:
      `Ciao ${opts.nome},\n\n${opts.invitante} ti ha invitato a usare la piattaforma dello Studio EMVAS.\n` +
      `Per impostare la tua password e accedere apri questo link (valido ${INVITE_DAYS} giorni):\n\n${opts.link}\n\n` +
      `Se non ti aspettavi questo invito puoi ignorare questa email.`,
  });
}

/** Password leggibile: lettere e cifre, 12 caratteri (senza caratteri ambigui). */
function generatePassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += alphabet[randomInt(alphabet.length)];
  // garantisce almeno una lettera e una cifra
  return out.replace(/^./, "a").replace(/.$/, "7");
}

// ---------------------------------------------------------------------------
// Collaboratori
// ---------------------------------------------------------------------------
// Solo la palette COLORI_UTENTE: avatar ed etichette del calendario usano testo bianco sul colore scelto
const coloreSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((c) => COLORI_UTENTE.includes(c), "Colore non valido.");

const staffSchema = z.object({
  nome: z.string().trim().min(2, "Inserisci il nome.").max(120, "Nome troppo lungo."),
  email: z.string().trim().min(1, "Inserisci l'email.").max(200).pipe(z.email("Email non valida.")),
  ruolo: z.enum(["ADMIN", "COLLABORATORE"], { message: "Ruolo non valido." }),
  colore: coloreSchema,
});

/** Avvisa l'interessato (in-app + email) quando un amministratore rigenera le sue credenziali. */
async function notificaCredenziali(target: { id: string }, admin: CurrentUser, titolo: string, corpo: string) {
  if (target.id === admin.id) return;
  await notify({ userId: target.id, tipo: "SISTEMA", titolo, corpo, link: "/impostazioni", email: true });
}

export async function createCollaboratorAction(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  let admin: CurrentUser;
  try {
    admin = await requireAdminAction();
  } catch (e) {
    return { error: errorMessage(e, "Operazione non consentita.") };
  }
  const parsed = staffSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    ruolo: formData.get("ruolo") ?? "COLLABORATORE",
    colore: formData.get("colore") ?? COLORI_UTENTE[0],
  });
  if (!parsed.success) return { error: "Controlla i campi evidenziati.", fieldErrors: firstErrors(parsed.error) };
  const email = normalizeEmail(parsed.data.email);

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, ruolo: true } });
    if (existing) {
      return {
        error: existing.ruolo === "CLIENTE" ? "Questa email appartiene già a un utente del portale clienti." : "Esiste già un collaboratore con questa email.",
        fieldErrors: { email: "Email già registrata." },
      };
    }
    const invito = nuovoInvito();
    const user = await prisma.user.create({
      data: { nome: parsed.data.nome, email, ruolo: parsed.data.ruolo, colore: parsed.data.colore, ...invito },
      select: { id: true },
    });
    const link = appUrl(`/invito/${invito.inviteToken}`);
    const emailSent = await inviaEmailInvito({ to: email, nome: parsed.data.nome, link, invitante: admin.nome });
    await audit({
      userId: admin.id,
      azione: "COLLABORATORE_CREATO",
      entita: "User",
      entitaId: user.id,
      dettagli: { email, ruolo: parsed.data.ruolo, invitoEmail: emailSent },
    });
    revalidateTeam();
    return { ok: true, inviteLink: link, emailSent, nonce: Date.now() };
  } catch (e) {
    return { error: errorMessage(e, "Errore durante la creazione del collaboratore.") };
  }
}

export async function resendInviteAction(userId: string): Promise<TeamActionState> {
  try {
    const admin = await requireAdminAction();
    const id = z.string().min(1).parse(userId);
    const user = await prisma.user.findFirst({ where: { id, ruolo: { in: RUOLI_STAFF } }, select: { id: true, email: true, nome: true, attivo: true, passwordHash: true } });
    if (!user) return { error: "Collaboratore non trovato." };
    if (!user.attivo) return { error: "Riattiva il collaboratore prima di inviare un nuovo invito." };
    const invito = nuovoInvito();
    await prisma.user.update({ where: { id }, data: invito });
    const link = appUrl(`/invito/${invito.inviteToken}`);
    const emailSent = await inviaEmailInvito({ to: user.email, nome: user.nome, link, invitante: admin.nome });
    await audit({ userId: admin.id, azione: "INVITO_REINVIATO", entita: "User", entitaId: id, dettagli: { email: user.email, invitoEmail: emailSent } });
    // Un utente che ha già una password viene avvisato: il link permette di reimpostarla e accedere
    if (user.passwordHash) {
      await notificaCredenziali(
        user,
        admin,
        "Nuovo link di accesso generato per il tuo account",
        `${admin.nome} ha generato un nuovo link di invito per il tuo account (valido ${INVITE_DAYS} giorni): chi lo apre può impostare una nuova password. Se non lo hai richiesto, contatta subito lo studio.`,
      );
    }
    revalidateTeam();
    return { ok: true, inviteLink: link, emailSent, nonce: Date.now() };
  } catch (e) {
    return { error: errorMessage(e, "Errore durante il reinvio dell'invito.") };
  }
}

export async function setTempPasswordAction(userId: string, _prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  try {
    const admin = await requireAdminAction();
    const id = z.string().min(1).parse(userId);
    const user = await prisma.user.findFirst({ where: { id, ruolo: { in: RUOLI_STAFF } }, select: { id: true, email: true, attivo: true, passwordHash: true } });
    if (!user) return { error: "Collaboratore non trovato." };
    if (!user.attivo) return { error: "Riattiva il collaboratore prima di impostare una password." };
    let password = String(formData.get("password") ?? "").trim();
    if (!password) password = generatePassword();
    const weak = validatePasswordStrength(password);
    if (weak) return { error: weak, fieldErrors: { password: weak } };
    await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password), inviteToken: null, inviteExpires: null } });
    await audit({ userId: admin.id, azione: "PASSWORD_TEMPORANEA", entita: "User", entitaId: id, dettagli: { email: user.email, sostituita: !!user.passwordHash } });
    // L'interessato viene sempre avvisato (in-app + email) che le sue credenziali sono state cambiate da un amministratore
    await notificaCredenziali(
      user,
      admin,
      user.passwordHash ? "La tua password è stata sostituita da un amministratore" : "Password temporanea impostata per il tuo account",
      `${admin.nome} ha impostato una password temporanea per il tuo account. Cambiala al primo accesso da Impostazioni. Se non lo hai richiesto, contatta subito lo studio.`,
    );
    revalidateTeam();
    return { ok: true, password, nonce: Date.now() };
  } catch (e) {
    return { error: errorMessage(e, "Errore durante l'impostazione della password.") };
  }
}

const updateStaffSchema = z.object({
  nome: z.string().trim().min(2, "Inserisci il nome.").max(120, "Nome troppo lungo."),
  telefono: z.string().trim().max(40, "Telefono troppo lungo.").optional().or(z.literal("")),
  colore: coloreSchema,
});

export async function updateStaffAction(userId: string, _prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  try {
    const admin = await requireAdminAction();
    const id = z.string().min(1).parse(userId);
    const parsed = updateStaffSchema.safeParse({ nome: formData.get("nome"), telefono: formData.get("telefono") ?? "", colore: formData.get("colore") });
    if (!parsed.success) return { error: "Controlla i campi evidenziati.", fieldErrors: firstErrors(parsed.error) };
    const user = await prisma.user.findFirst({ where: { id, ruolo: { in: RUOLI_STAFF } }, select: { id: true } });
    if (!user) return { error: "Collaboratore non trovato." };
    await prisma.user.update({
      where: { id },
      data: { nome: parsed.data.nome, telefono: parsed.data.telefono || null, colore: parsed.data.colore },
    });
    await audit({ userId: admin.id, azione: "COLLABORATORE_MODIFICATO", entita: "User", entitaId: id, dettagli: parsed.data });
    revalidateTeam();
    // se l'admin modifica se stesso, nome e colore compaiono anche in sidebar/top bar (layout)
    if (id === admin.id) revalidatePath("/", "layout");
    return { ok: true, nonce: Date.now() };
  } catch (e) {
    return { error: errorMessage(e, "Errore durante il salvataggio.") };
  }
}

export async function changeRoleAction(userId: string, ruolo: string): Promise<TeamActionState> {
  try {
    const admin = await requireAdminAction();
    const parsed = z.object({ id: z.string().min(1), ruolo: z.enum(["ADMIN", "COLLABORATORE"]) }).safeParse({ id: userId, ruolo });
    if (!parsed.success) return { error: "Ruolo non valido." };
    const user = await prisma.user.findFirst({ where: { id: parsed.data.id, ruolo: { in: RUOLI_STAFF } }, select: { id: true, ruolo: true, attivo: true } });
    if (!user) return { error: "Collaboratore non trovato." };
    if (user.ruolo === parsed.data.ruolo) return { ok: true };
    if (user.ruolo === "ADMIN" && parsed.data.ruolo !== "ADMIN") {
      if (user.id === admin.id) return { error: "Non puoi togliere il ruolo di amministratore a te stesso." };
      const altriAdmin = await prisma.user.count({ where: { ruolo: "ADMIN", attivo: true, id: { not: user.id } } });
      if (altriAdmin === 0) return { error: "Deve restare almeno un amministratore attivo." };
    }
    await prisma.user.update({ where: { id: user.id }, data: { ruolo: parsed.data.ruolo } });
    await audit({ userId: admin.id, azione: "RUOLO_MODIFICATO", entita: "User", entitaId: user.id, dettagli: { da: user.ruolo, a: parsed.data.ruolo } });
    revalidateTeam();
    return { ok: true };
  } catch (e) {
    return { error: errorMessage(e, "Errore durante la modifica del ruolo.") };
  }
}

export async function setStaffActiveAction(userId: string, attivo: boolean): Promise<TeamActionState> {
  try {
    const admin = await requireAdminAction();
    const id = z.string().min(1).parse(userId);
    const user = await prisma.user.findFirst({ where: { id, ruolo: { in: RUOLI_STAFF } }, select: { id: true, ruolo: true, attivo: true, email: true } });
    if (!user) return { error: "Collaboratore non trovato." };
    if (!attivo) {
      if (user.id === admin.id) return { error: "Non puoi disattivare il tuo stesso account." };
      if (user.ruolo === "ADMIN") {
        const altriAdmin = await prisma.user.count({ where: { ruolo: "ADMIN", attivo: true, id: { not: user.id } } });
        if (altriAdmin === 0) return { error: "Non puoi disattivare l'ultimo amministratore attivo." };
      }
    }
    await prisma.user.update({ where: { id }, data: { attivo, ...(attivo ? {} : { inviteToken: null, inviteExpires: null }) } });
    await audit({ userId: admin.id, azione: attivo ? "COLLABORATORE_RIATTIVATO" : "COLLABORATORE_DISATTIVATO", entita: "User", entitaId: id, dettagli: { email: user.email } });
    revalidateTeam();
    return { ok: true };
  } catch (e) {
    return { error: errorMessage(e, "Errore durante l'aggiornamento.") };
  }
}

// ---------------------------------------------------------------------------
// Accettazione invito (pagina pubblica /invito/[token])
// ---------------------------------------------------------------------------
export interface InviteState {
  error?: string;
}

/**
 * Non richiede sessione: il "guard" è il token di invito stesso (univoco, con scadenza),
 * verificato di nuovo qui prima di qualsiasi scrittura.
 */
export async function acceptInviteAction(token: string, _prev: InviteState, formData: FormData): Promise<InviteState> {
  const parsed = z
    .object({
      token: z.string().regex(/^[0-9a-f]{64}$/, "Invito non valido."),
      password: z.string().min(1, "Inserisci la password."),
      conferma: z.string(),
    })
    .safeParse({ token, password: formData.get("password"), conferma: formData.get("conferma") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  const weak = validatePasswordStrength(parsed.data.password);
  if (weak) return { error: weak };
  if (parsed.data.password !== parsed.data.conferma) return { error: "Le due password non coincidono." };

  const user = await prisma.user.findUnique({ where: { inviteToken: parsed.data.token } });
  if (!user || !user.attivo || !user.inviteExpires || user.inviteExpires < new Date()) {
    return { error: "Invito non valido o scaduto. Chiedi allo studio di inviartene uno nuovo." };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.password), inviteToken: null, inviteExpires: null, lastLoginAt: new Date() },
  });
  await createSession({ sub: user.id, email: user.email, nome: user.nome, ruolo: user.ruolo as Ruolo });
  await audit({ userId: user.id, azione: "INVITO_ACCETTATO", entita: "User", entitaId: user.id });
  redirect(user.ruolo === "CLIENTE" ? "/portale" : "/dashboard");
}

// ---------------------------------------------------------------------------
// Assenze
// ---------------------------------------------------------------------------
const absenceSchema = z
  .object({
    tipo: z.enum(Object.keys(TIPI_ASSENZA) as [string, ...string[]], { message: "Tipo non valido." }),
    dataInizio: z.string().min(1, "Inserisci la data di inizio."),
    dataFine: z.string().min(1, "Inserisci la data di fine."),
    note: z.string().trim().max(500, "Note troppo lunghe (max 500 caratteri).").optional().or(z.literal("")),
    userId: z.string().trim().optional().or(z.literal("")),
  })
  .transform((v, ctx) => {
    const inizio = parseDateInput(v.dataInizio);
    const fine = parseDateInput(v.dataFine);
    if (!inizio) ctx.addIssue({ code: "custom", path: ["dataInizio"], message: "Data di inizio non valida." });
    if (!fine) ctx.addIssue({ code: "custom", path: ["dataFine"], message: "Data di fine non valida." });
    if (inizio && fine && fine < inizio) ctx.addIssue({ code: "custom", path: ["dataFine"], message: "La data di fine deve essere uguale o successiva all'inizio." });
    return { ...v, inizio: inizio!, fine: fine!, note: v.note || null, userId: v.userId || "" };
  });

async function assenzeSovrapposte(userId: string, inizio: Date, fine: Date, excludeId?: string) {
  return prisma.absence.findMany({
    where: { userId, stato: { not: "RIFIUTATA" }, dataInizio: { lte: fine }, dataFine: { gte: inizio }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { dataInizio: true, dataFine: true, stato: true },
  });
}

export async function requestAbsenceAction(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  let user: CurrentUser;
  try {
    user = await requireStaffAction();
  } catch (e) {
    return { error: errorMessage(e, "Operazione non consentita.") };
  }
  const parsed = absenceSchema.safeParse({
    tipo: formData.get("tipo"),
    dataInizio: formData.get("dataInizio"),
    dataFine: formData.get("dataFine"),
    note: formData.get("note") ?? "",
    userId: formData.get("userId") ?? "",
  });
  if (!parsed.success) return { error: "Controlla i campi evidenziati.", fieldErrors: firstErrors(parsed.error) };
  const d = parsed.data;

  try {
    // L'amministratore può inserire direttamente un'assenza (approvata) per un altro collaboratore
    const perAltro = user.ruolo === "ADMIN" && d.userId && d.userId !== user.id;
    let targetId = user.id;
    let targetNome = user.nome;
    if (perAltro) {
      const target = await prisma.user.findFirst({ where: { id: d.userId, ruolo: { in: RUOLI_STAFF }, attivo: true }, select: { id: true, nome: true } });
      if (!target) return { error: "Collaboratore non valido.", fieldErrors: { userId: "Seleziona un collaboratore attivo." } };
      targetId = target.id;
      targetNome = target.nome;
    }
    const stato = perAltro ? "APPROVATA" : "RICHIESTA";
    const sovrapposte = await assenzeSovrapposte(targetId, d.inizio, d.fine);

    const created = await prisma.absence.create({
      data: {
        userId: targetId,
        tipo: d.tipo,
        dataInizio: d.inizio,
        dataFine: d.fine,
        note: d.note,
        stato,
        approvedById: perAltro ? user.id : null,
      },
      select: { id: true },
    });
    await audit({
      userId: user.id,
      azione: perAltro ? "ASSENZA_INSERITA" : "ASSENZA_RICHIESTA",
      entita: "Absence",
      entitaId: created.id,
      dettagli: { userId: targetId, tipo: d.tipo, dataInizio: d.inizio, dataFine: d.fine, stato },
    });
    const periodo = `${formatDate(d.inizio)} – ${formatDate(d.fine)}`;
    if (perAltro) {
      await notify({
        userId: targetId,
        tipo: "ASSENZA_APPROVATA",
        titolo: `Assenza inserita: ${TIPI_ASSENZA[d.tipo as keyof typeof TIPI_ASSENZA]} ${periodo}`,
        corpo: `${user.nome} ha registrato per te un'assenza già approvata.`,
        link: "/team/assenze",
      });
    } else {
      await notifyAdmins(
        {
          tipo: "ASSENZA_RICHIESTA",
          titolo: `${targetNome} chiede ${TIPI_ASSENZA[d.tipo as keyof typeof TIPI_ASSENZA].toLowerCase()}: ${periodo}`,
          corpo: d.note ? `Note: ${d.note}` : "Approva o rifiuta la richiesta dalla pagina Assenze.",
          link: "/team/assenze",
          email: true,
        },
        user.id,
      );
    }
    revalidateTeam();
    const warning = sovrapposte.length
      ? `Attenzione: ${targetNome === user.nome ? "hai" : `${targetNome} ha`} già ${sovrapposte.length === 1 ? "un'assenza" : `${sovrapposte.length} assenze`} nello stesso periodo (${sovrapposte
          .map((s) => `${formatDate(s.dataInizio)} – ${formatDate(s.dataFine)}, ${STATI_ASSENZA[s.stato as keyof typeof STATI_ASSENZA]?.toLowerCase() ?? s.stato}`)
          .join("; ")}).`
      : undefined;
    return { ok: true, warning, nonce: Date.now() };
  } catch (e) {
    return { error: errorMessage(e, "Errore durante il salvataggio dell'assenza.") };
  }
}

async function esitoAssenza(absenceId: string, esito: "APPROVATA" | "RIFIUTATA"): Promise<TeamActionState> {
  try {
    const admin = await requireAdminAction();
    const id = z.string().min(1).parse(absenceId);
    const a = await prisma.absence.findUnique({ where: { id }, include: { user: { select: { id: true, nome: true } } } });
    if (!a) return { error: "Assenza non trovata." };
    if (a.stato === esito) return { ok: true };
    await prisma.absence.update({ where: { id }, data: { stato: esito, approvedById: admin.id } });
    await audit({ userId: admin.id, azione: esito === "APPROVATA" ? "ASSENZA_APPROVATA" : "ASSENZA_RIFIUTATA", entita: "Absence", entitaId: id, dettagli: { userId: a.userId } });
    if (a.userId !== admin.id) {
      const periodo = `${formatDate(a.dataInizio)} – ${formatDate(a.dataFine)}`;
      await notify({
        userId: a.userId,
        tipo: esito === "APPROVATA" ? "ASSENZA_APPROVATA" : "ASSENZA_RIFIUTATA",
        titolo: `${TIPI_NOTIFICA[esito === "APPROVATA" ? "ASSENZA_APPROVATA" : "ASSENZA_RIFIUTATA"]}: ${TIPI_ASSENZA[a.tipo as keyof typeof TIPI_ASSENZA] ?? a.tipo} ${periodo}`,
        corpo: `${admin.nome} ha ${esito === "APPROVATA" ? "approvato" : "rifiutato"} la tua richiesta di assenza.`,
        link: "/team/assenze",
        email: true,
      });
    }
    revalidateTeam();
    return { ok: true };
  } catch (e) {
    return { error: errorMessage(e, "Errore durante l'aggiornamento dell'assenza.") };
  }
}

export async function approveAbsenceAction(absenceId: string) {
  return esitoAssenza(absenceId, "APPROVATA");
}

export async function rejectAbsenceAction(absenceId: string) {
  return esitoAssenza(absenceId, "RIFIUTATA");
}

/** Elimina un'assenza: l'amministratore qualsiasi, l'utente solo le proprie richieste in attesa. */
export async function deleteAbsenceAction(absenceId: string): Promise<TeamActionState> {
  try {
    const user = await requireStaffAction();
    const id = z.string().min(1).parse(absenceId);
    const a = await prisma.absence.findUnique({ where: { id }, select: { id: true, userId: true, stato: true, dataInizio: true, dataFine: true, tipo: true } });
    if (!a) return { error: "Assenza non trovata." };
    const propria = a.userId === user.id;
    if (user.ruolo !== "ADMIN") {
      if (!propria) return { error: "Puoi annullare solo le tue richieste." };
      if (a.stato !== "RICHIESTA") return { error: "Puoi annullare solo le richieste ancora in attesa. Per le altre contatta un amministratore." };
    }
    await prisma.absence.delete({ where: { id } });
    await audit({
      userId: user.id,
      azione: propria && a.stato === "RICHIESTA" ? "ASSENZA_ANNULLATA" : "ASSENZA_ELIMINATA",
      entita: "Absence",
      entitaId: id,
      dettagli: { userId: a.userId, tipo: a.tipo, dataInizio: a.dataInizio, dataFine: a.dataFine, stato: a.stato },
    });
    // Il proprietario viene avvisato anche quando l'admin elimina una sua richiesta ancora in attesa
    // (altrimenti resterebbe ad aspettare un esito che non arriverà mai)
    if (!propria) {
      const pendente = a.stato === "RICHIESTA";
      await notify({
        userId: a.userId,
        tipo: "SISTEMA",
        titolo: `${pendente ? "Richiesta di assenza eliminata" : "Assenza eliminata"}: ${formatDate(a.dataInizio)} – ${formatDate(a.dataFine)}`,
        corpo: pendente
          ? `${user.nome} ha eliminato la tua richiesta di assenza senza approvarla. Se serve, presenta una nuova richiesta.`
          : `${user.nome} ha eliminato la tua assenza (${STATI_ASSENZA[a.stato as keyof typeof STATI_ASSENZA] ?? a.stato}).`,
        link: "/team/assenze",
        email: pendente,
      });
    }
    revalidateTeam();
    return { ok: true };
  } catch (e) {
    return { error: errorMessage(e, "Errore durante l'eliminazione dell'assenza.") };
  }
}

// ---------------------------------------------------------------------------
// Dashboard: completamento rapido di un'attività
// ---------------------------------------------------------------------------
export async function completaTaskDashboardAction(formData: FormData): Promise<void> {
  // Usata come <form action>: una sessione scaduta non deve produrre la pagina di errore ma il login
  let user: CurrentUser | null = null;
  try {
    user = await requireStaffAction();
  } catch (e) {
    if (!(e instanceof AuthError)) throw e;
  }
  if (!user) redirect("/login?next=/dashboard");
  const parsedId = z.string().min(1).safeParse(formData.get("id"));
  if (!parsedId.success) return;
  const id = parsedId.data;
  const task = await prisma.task.findUnique({ where: { id }, select: { id: true, stato: true, titolo: true } });
  if (!task || !["DA_FARE", "IN_CORSO"].includes(task.stato)) return;
  await prisma.task.update({ where: { id }, data: { stato: "COMPLETATA", completatoAt: new Date() } });
  await audit({ userId: user.id, azione: "TASK_COMPLETATA", entita: "Task", entitaId: id, dettagli: { titolo: task.titolo, da: task.stato, origine: "dashboard" } });
  revalidatePath("/dashboard");
  revalidatePath("/attivita");
  revalidatePath(`/attivita/${id}`);
  revalidatePath("/scadenzario");
}
