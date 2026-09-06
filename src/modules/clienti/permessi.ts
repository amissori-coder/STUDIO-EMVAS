import { isAdmin, type CurrentUser } from "@/lib/auth/guards";

/** Admin oppure referente del cliente: può gestire gli accessi al portale (creazione, collegamento, password, attivazione). */
export function canManagePortalAccess(user: CurrentUser, client: { referenteId: string | null }) {
  return isAdmin(user) || (client.referenteId !== null && client.referenteId === user.id);
}

/**
 * Chi può cambiare il referente di un cliente: gli amministratori sempre; un collaboratore solo se il cliente
 * non ha ancora un referente oppure se il referente attuale è lui stesso (passaggio di consegne).
 * Evita che un collaboratore si assegni un cliente altrui per poi gestirne gli accessi al portale.
 */
export function canChangeReferente(user: CurrentUser, client: { referenteId: string | null }) {
  return isAdmin(user) || client.referenteId === null || client.referenteId === user.id;
}
