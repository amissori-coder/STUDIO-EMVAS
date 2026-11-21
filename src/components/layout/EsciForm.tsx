"use client";
import type { FormEvent, ReactNode } from "react";

/** Tempo massimo concesso alla revoca delle notifiche: l'uscita non deve mai restare bloccata. */
const ATTESA_MASSIMA_MS = 1500;

function entro<T>(promessa: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promessa, new Promise<null>((fine) => setTimeout(() => fine(null), ms))]);
}

/**
 * Revoca la sottoscrizione push di QUESTO dispositivo e ne restituisce l'indirizzo, così il server
 * può cancellarla: dopo l'uscita il computer non riceve più avvisi con i dati dei clienti.
 * Su un browser senza service worker o senza notifiche push non fa nulla. Non lancia mai.
 */
async function revocaNotificheDelDispositivo(): Promise<string | null> {
  try {
    if (!("serviceWorker" in navigator)) return null;
    const registrazione = await entro(navigator.serviceWorker.ready, ATTESA_MASSIMA_MS);
    const gestore = registrazione && "pushManager" in registrazione ? registrazione.pushManager : null;
    if (!gestore) return null;
    const sottoscrizione = await entro(gestore.getSubscription(), ATTESA_MASSIMA_MS);
    if (!sottoscrizione) return null;
    await entro(sottoscrizione.unsubscribe().catch(() => false), ATTESA_MASSIMA_MS);
    return sottoscrizione.endpoint;
  } catch {
    return null;
  }
}

/**
 * Modulo di uscita. Senza JavaScript è un normale POST a /api/auth/logout. Con JavaScript, prima di
 * inviarlo revoca le notifiche push del dispositivo; qualunque cosa vada storta, l'uscita avviene
 * comunque (al più dopo ATTESA_MASSIMA_MS).
 */
export function EsciForm({ className, children }: { className?: string; children: ReactNode }) {
  async function esci(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const modulo = e.currentTarget;
    const endpoint = await revocaNotificheDelDispositivo();
    const campo = modulo.elements.namedItem("endpoint");
    if (endpoint && campo instanceof HTMLInputElement) campo.value = endpoint;
    modulo.submit(); // submit() nativo: non riattiva questo gestore
  }

  return (
    <form action="/api/auth/logout" method="post" className={className} onSubmit={esci}>
      <input type="hidden" name="endpoint" defaultValue="" />
      {children}
    </form>
  );
}
