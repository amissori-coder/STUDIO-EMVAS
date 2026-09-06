"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserAction } from "@/lib/auth/guards";
import { deleteDocumentAction } from "@/modules/documenti/actions";
import { PORTAL_CLIENT_COOKIE } from "./service";

/** Seleziona il cliente corrente nel portale (utenti collegati a più clienti): salva il cookie e torna alla home. */
export async function selectPortalClientAction(formData: FormData) {
  const user = await requireUserAction();
  const parsed = z.string().min(1).safeParse(formData.get("clientId"));
  if (!parsed.success || !user.clientIds.includes(parsed.data)) redirect("/portale");
  const store = await cookies();
  store.set(PORTAL_CLIENT_COOKIE, parsed.data, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && (process.env.APP_URL ?? "").startsWith("https"),
    path: "/portale",
    maxAge: 365 * 24 * 60 * 60,
  });
  revalidatePath("/portale");
  redirect(`/portale?cliente=${encodeURIComponent(parsed.data)}`);
}

/** Elimina un documento caricato dal cliente (form con ConfirmButton nella pagina cartella). */
export async function deletePortalDocumentAction(folderId: string, documentId: string) {
  await requireUserAction();
  const r = await deleteDocumentAction(documentId);
  const back = `/portale/cartelle/${encodeURIComponent(folderId)}`;
  if (r.error) redirect(`${back}?errore=${encodeURIComponent(r.error)}`);
  redirect(`${back}?messaggio=eliminato`);
}
