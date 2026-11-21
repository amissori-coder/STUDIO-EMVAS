/**
 * In quale cartella salvare l'allegato di un'email. Modulo puro, provato da
 * tests/unit/cartella-allegati.test.ts.
 *
 * Un allegato salvato dallo studio può essere corrispondenza interna (la bozza di una dichiarazione,
 * lo scambio con un collega): non deve finire per scelta automatica in una cartella che il cliente
 * vede nel portale. Per questo la cartella proposta è sempre una riservata allo studio; se il cliente
 * non ne ha, nessuna cartella viene proposta e la scelta va fatta esplicitamente.
 */

export interface CartellaPerAllegati {
  id: string;
  nome: string;
  ordine: number;
  visibileCliente: boolean;
}

/** Ordine stabile: a parità di `ordine` decide il nome, poi l'id (mai il database). */
export function ordinaCartelle<T extends CartellaPerAllegati>(cartelle: T[]): T[] {
  return [...cartelle].sort((a, b) => a.ordine - b.ordine || a.nome.localeCompare(b.nome, "it") || a.id.localeCompare(b.id));
}

/** La cartella proposta: la prima riservata allo studio, oppure nessuna. */
export function cartellaProposta(cartelle: CartellaPerAllegati[]): string | null {
  return ordinaCartelle(cartelle).find((c) => !c.visibileCliente)?.id ?? null;
}

export type SceltaCartella = { ok: true; folderId: string | null } | { ok: false; errore: string };

/**
 * La cartella da usare per il salvataggio: quella scelta se appartiene al cliente; altrimenti la
 * proposta; altrimenti, se il cliente non ha cartelle, nessuna (il documento resta visibile solo allo
 * studio); altrimenti si chiede di scegliere invece di indovinare.
 */
export function cartellaDiSalvataggio(sceltaId: string | null | undefined, cartelle: CartellaPerAllegati[]): SceltaCartella {
  if (sceltaId) {
    return cartelle.some((c) => c.id === sceltaId) ? { ok: true, folderId: sceltaId } : { ok: false, errore: "Cartella non valida." };
  }
  if (cartelle.length === 0) return { ok: true, folderId: null };
  const proposta = cartellaProposta(cartelle);
  if (proposta) return { ok: true, folderId: proposta };
  return { ok: false, errore: "Scegli la cartella in cui salvare l'allegato: tutte le cartelle di questo cliente sono visibili nel portale." };
}
