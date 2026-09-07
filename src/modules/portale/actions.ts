"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserAction } from "@/lib/auth/guards";
import { deleteDocumentAction } from "@/modules/documenti/actions";
import { PORTAL_CLIENT_COOKIE, portalClientCookieOptions, portalErrorCode } from "./service";

/** Seleziona il cliente corrente nel portale (utenti collegati a più clienti): salva il cookie e torna alla home. */
export async function selectPortalClientAction(formData: FormData) {
  const user = await requireUserAction();
  const parsed = z.string().min(1).safeParse(formData.get("clientId"));
  if (!parsed.success || !user.clientIds.includes(parsed.data)) redirect("/portale");
  const store = await cookies();
  store.set(PORTAL_CLIENT_COOKIE, parsed.data, portalClientCookieOptions());
  revalidatePath("/portale");
  redirect(`/portale?cliente=${encodeURIComponent(parsed.data)}`);
}

/**
 * Allinea il cookie del cliente corrente a quello effettivamente mostrato (chiamata dal selettore
 * dell'intestazione quando la pagina aperta — es. una cartella raggiunta da una notifica — appartiene
 * a un altro cliente dell'utente). Nessun redirect: la pagina resta dov'è.
 */
export async function syncPortalClientAction(clientId: string) {
  const user = await requireUserAction();
  const parsed = z.string().min(1).safeParse(clientId);
  if (!parsed.success || !user.clientIds.includes(parsed.data)) return;
  const store = await cookies();
  if (store.get(PORTAL_CLIENT_COOKIE)?.value === parsed.data) return;
  store.set(PORTAL_CLIENT_COOKIE, parsed.data, portalClientCookieOptions());
}

/**
 * Elimina un documento caricato dal cliente (form con ConfirmButton nella pagina cartella).
 * In caso di errore nella query passa solo un codice (mai testo libero: un link costruito ad hoc potrebbe
 * altrimenti mostrare messaggi arbitrari ai clienti nell'avviso «ufficiale» del portale).
 */
export async function deletePortalDocumentAction(folderId: string, documentId: string) {
  await requireUserAction();
  const r = await deleteDocumentAction(documentId);
  const back = `/portale/cartelle/${encodeURIComponent(folderId)}`;
  if (r.error) redirect(`${back}?errore=${portalErrorCode(r.error)}`);
  redirect(`${back}?messaggio=eliminato`);
}
