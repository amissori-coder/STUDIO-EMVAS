import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "@/lib/auth/guards";
import { isSafeInternalPath } from "@/lib/auth/redirect";

/**
 * Per le azioni usate direttamente come `<form action>`: se la sessione è scaduta porta alla pagina di
 * accesso, che poi riporta alla pagina da cui si è partiti, invece di mostrare la pagina di errore
 * generica. Ogni altro errore prosegue come prima.
 */
export async function conSessione<T>(lavoro: () => Promise<T>): Promise<T> {
  try {
    return await lavoro();
  } catch (e) {
    if (e instanceof AuthError && e.status === 401) {
      let next = "";
      try {
        const provenienza = (await headers()).get("referer");
        if (provenienza) {
          const url = new URL(provenienza);
          next = url.pathname + url.search;
        }
      } catch {
        // intestazione assente o non valida: si torna alla pagina iniziale dopo l'accesso
      }
      redirect(isSafeInternalPath(next) ? `/login?next=${encodeURIComponent(next)}` : "/login");
    }
    throw e;
  }
}
