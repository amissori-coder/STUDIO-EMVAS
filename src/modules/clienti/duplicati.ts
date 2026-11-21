/**
 * Clienti con lo stesso codice fiscale o la stessa partita IVA. Non è un divieto (la stessa persona può
 * essere cliente come privato e come ditta), ma va confermato: un doppione per errore divide email,
 * documenti e scadenze fra due schede. Modulo puro, provato da tests/unit/duplicati-clienti.test.ts.
 */

export interface Identificativi {
  codiceFiscale: string | null;
  partitaIva: string | null;
}

export interface Duplicato {
  valore: string;
  /** dove compare il valore nella scheda salvata: codice fiscale, partita IVA o entrambi */
  campi: ("codiceFiscale" | "partitaIva")[];
  clienti: { id: string; denominazione: string; attivo: boolean }[];
}

/**
 * Valori da controllare: alla creazione quelli presenti; in modifica solo quelli cambiati, così il
 * salvataggio di un altro campo (un telefono, una nota) non viene mai bloccato da un doppione già
 * accettato in passato.
 */
export function valoriDaControllare(nuovo: Identificativi, precedente?: Identificativi | null): string[] {
  const cambiati = (["codiceFiscale", "partitaIva"] as const).filter((k) => nuovo[k] && nuovo[k] !== (precedente?.[k] ?? null));
  return [...new Set(cambiati.map((k) => nuovo[k]!))];
}

/** Raggruppa gli altri clienti trovati per valore (un valore può comparire come CF o come P.IVA altrui). */
export function raggruppaDuplicati(
  nuovo: Identificativi,
  valori: string[],
  altri: { id: string; denominazione: string; attivo: boolean; codiceFiscale: string | null; partitaIva: string | null }[],
): Duplicato[] {
  return valori
    .map((valore) => ({
      valore,
      campi: (["codiceFiscale", "partitaIva"] as const).filter((k) => nuovo[k] === valore),
      clienti: altri.filter((c) => c.codiceFiscale === valore || c.partitaIva === valore).map(({ id, denominazione, attivo }) => ({ id, denominazione, attivo })),
    }))
    .filter((d) => d.clienti.length > 0);
}

/** Valore del campo nascosto con cui l'utente conferma proprio questi doppioni. */
export function chiaveConferma(duplicati: Duplicato[]) {
  return [...new Set(duplicati.map((d) => d.valore))].sort().join(",");
}

/** Confermati solo se l'utente ha confermato TUTTI i valori doppi attuali (non quelli di un tentativo precedente). */
export function duplicatiConfermati(conferma: string, duplicati: Duplicato[]) {
  const dati = new Set(conferma.split(",").filter(Boolean));
  return duplicati.every((d) => dati.has(d.valore));
}

const NOMI = { codiceFiscale: "codice fiscale", partitaIva: "partita IVA" } as const;

export function messaggioDuplicati(duplicati: Duplicato[]) {
  const campi = [...new Set(duplicati.flatMap((d) => d.campi))];
  const cosa = campi.length === 2 ? "lo stesso codice fiscale e la stessa partita IVA" : campi[0] === "partitaIva" ? "la stessa partita IVA" : "lo stesso codice fiscale";
  const quanti = new Set(duplicati.flatMap((d) => d.clienti.map((c) => c.id))).size;
  return `${quanti === 1 ? "Esiste già un cliente" : `Esistono già ${quanti} clienti`} con ${cosa}. Controlla che non sia un doppione; se è davvero un cliente diverso, conferma e salva di nuovo.`;
}

/** «Codice fiscale», «Partita IVA» o «Codice fiscale e partita IVA», per l'elenco dei doppioni. */
export function descriviCampi(d: Duplicato) {
  const testo = d.campi.map((c) => NOMI[c]).join(" e ");
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}
