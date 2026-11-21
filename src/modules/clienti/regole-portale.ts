/**
 * Regole sugli accessi al portale clienti, senza dipendenze dal server: provate da
 * tests/unit/regole-portale.test.ts.
 */

export interface CollegamentoPortale {
  clientId: string;
  denominazione: string;
  referenteId: string | null;
}

/**
 * Clienti collegati a un utente del portale che chi agisce NON può gestire.
 *
 * Password e attivazione sono proprietà dell'utente, non del collegamento: valgono per tutte le
 * aziende a cui l'utente accede. Il referente di una sola azienda che reimpostasse la password di un
 * utente collegato anche ad altre potrebbe entrare nel portale al suo posto e leggere i documenti di
 * clienti che non gli competono. Quindi chi agisce deve poter gestire TUTTI i clienti collegati:
 * l'amministratore sempre, il referente solo se è referente di ciascuno.
 */
export function clientiFuoriGestione(attore: { id: string; ruolo: string }, collegamenti: CollegamentoPortale[]) {
  if (attore.ruolo === "ADMIN") return [];
  return collegamenti.filter((c) => c.referenteId !== attore.id);
}

/** Messaggio per chi non può cambiare password o attivazione di un utente collegato ad altre aziende. */
export function messaggioFuoriGestione(nomeUtente: string, fuori: CollegamentoPortale[]) {
  const elenco = fuori.map((c) => `«${c.denominazione}»`).join(", ");
  return (
    `${nomeUtente} accede al portale anche per ${elenco}: password e attivazione valgono per tutte le aziende, ` +
    "quindi può cambiarle solo un amministratore. Da qui puoi scollegarlo da questo cliente."
  );
}
