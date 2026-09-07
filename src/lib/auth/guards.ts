import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { RUOLI_STAFF, type Ruolo } from "@/lib/constants";

export type CurrentUser = {
  id: string;
  email: string;
  nome: string;
  ruolo: Ruolo;
  colore: string;
  telefono: string | null;
  notificaEmail: boolean;
  notificaPush: boolean;
  hasGoogle: boolean;
  /** Per gli utenti CLIENTE: id dei clienti a cui hanno accesso */
  clientIds: string[];
};

/** Utente corrente caricato dal DB (verifica che sia ancora attivo). Memoizzato per richiesta. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: { googleAccount: { select: { id: true } }, accessiClienti: { select: { clientId: true } } },
  });
  if (!user || !user.attivo) return null;
  // sessione emessa prima di un reset password: non più valida
  if ((session.sv ?? 0) !== user.sessionVersion) return null;
  return {
    id: user.id,
    email: user.email,
    nome: user.nome,
    ruolo: user.ruolo as Ruolo,
    colore: user.colore,
    telefono: user.telefono,
    notificaEmail: user.notificaEmail,
    notificaPush: user.notificaPush,
    hasGoogle: !!user.googleAccount,
    clientIds: user.accessiClienti.map((a) => a.clientId),
  };
});

export function isStaff(user: { ruolo: Ruolo } | null | undefined) {
  return !!user && RUOLI_STAFF.includes(user.ruolo);
}

export function isAdmin(user: { ruolo: Ruolo } | null | undefined) {
  return !!user && user.ruolo === "ADMIN";
}

/** Da usare nelle pagine/layout: reindirizza al login se non autenticato o non staff. */
export async function requireStaff(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isStaff(user)) redirect("/portale");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireStaff();
  if (!isAdmin(user)) redirect("/dashboard?errore=solo-admin");
  return user;
}

/** Utente del portale clienti. */
export async function requireClientUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.ruolo !== "CLIENTE") redirect("/dashboard");
  return user;
}

/** Verifica che l'utente CLIENTE abbia accesso al cliente indicato. */
export function canAccessClient(user: CurrentUser, clientId: string) {
  if (isStaff(user)) return true;
  return user.clientIds.includes(clientId);
}

// ---- Varianti per Server Action / Route Handler: lanciano un errore invece di reindirizzare ----

export class AuthError extends Error {
  status: number;
  constructor(message = "Non autorizzato", status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireStaffAction(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Sessione scaduta: effettua di nuovo l'accesso.", 401);
  if (!isStaff(user)) throw new AuthError("Operazione riservata allo staff dello studio.", 403);
  return user;
}

export async function requireAdminAction(): Promise<CurrentUser> {
  const user = await requireStaffAction();
  if (!isAdmin(user)) throw new AuthError("Operazione riservata agli amministratori.", 403);
  return user;
}

export async function requireUserAction(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Sessione scaduta: effettua di nuovo l'accesso.", 401);
  return user;
}

export async function requireClientAccessAction(clientId: string): Promise<CurrentUser> {
  const user = await requireUserAction();
  if (!canAccessClient(user, clientId)) throw new AuthError("Accesso al cliente non consentito.", 403);
  return user;
}
