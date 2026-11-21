/**
 * Regole dell'importazione Gmail, senza rete né database: provate da tests/unit/gmail-regole.test.ts.
 */

/** Messaggi elencati al massimo per esecuzione nelle ricerche per data (100 per chiamata, solo gli id). */
export const LIMITE_ELENCO = 5000;

/**
 * Un indirizzo (o un gruppo di indirizzi) identifica un cliente solo se corrisponde a uno e un solo
 * cliente. Un indirizzo condiviso (lo stesso consulente per due società, una PEC comune) non deve
 * associare l'email a uno dei due a caso: la posta di un cliente finirebbe nella scheda di un altro.
 */
export function clienteUnivoco(candidati: string[]): string | null {
  const distinti = [...new Set(candidati)];
  return distinti.length === 1 ? distinti[0]! : null;
}

/**
 * Quanti giorni cercare quando la storia di Gmail non è più disponibile: dall'ultima sincronizzazione
 * COMPLETA (non dall'ultimo tentativo), con un minimo di una settimana.
 */
export function giorniDaRecuperare(ultimaCompleta: Date | null, adesso: Date, predefiniti: number) {
  if (!ultimaCompleta) return predefiniti;
  return Math.max(7, Math.ceil((adesso.getTime() - ultimaCompleta.getTime()) / 86_400_000) + 1);
}

export interface PianoImportazione {
  /** id da scaricare in questa esecuzione */
  daScaricare: string[];
  /** messaggi nuovi lasciati alla prossima esecuzione per il limite */
  restanti: number;
  /**
   * Il punto di ripresa (historyId) e l'ora dell'ultima sincronizzazione completa avanzano solo se non
   * resta nulla: altrimenti la prossima esecuzione riparte dallo stesso punto e prende i rimanenti
   * (quelli già importati si saltano). Prima si avanzava comunque e i messaggi oltre il limite si perdevano.
   */
  avanza: boolean;
}

export function pianoImportazione(elencati: string[], giaImportati: Set<string>, massimo: number): PianoImportazione {
  const nuovi = [...new Set(elencati)].filter((id) => !giaImportati.has(id));
  const daScaricare = nuovi.slice(0, Math.max(1, massimo));
  const restanti = nuovi.length - daScaricare.length;
  return { daScaricare, restanti, avanza: restanti === 0 };
}

export interface EsitoCasella {
  imported: number;
  linked: number;
  restanti: number;
  giaInCorso?: boolean;
  error?: string;
}

/** Messaggio per chi ha premuto «Sincronizza», con gli accordi singolare/plurale. */
export function riepilogoSincronizzazione(risultati: EsitoCasella[]): { ok: boolean; testo: string } {
  if (risultati.length && risultati.every((r) => r.giaInCorso)) {
    return { ok: false, testo: "Una sincronizzazione è già in corso: i nuovi messaggi compariranno fra pochi istanti." };
  }
  const importate = risultati.reduce((s, r) => s + r.imported, 0);
  const associate = risultati.reduce((s, r) => s + r.linked, 0);
  const restanti = risultati.reduce((s, r) => s + r.restanti, 0);
  const errori = risultati.map((r) => r.error?.replace(/\s+/g, " ")).filter(Boolean) as string[];
  if (errori.length) {
    const elenco = errori.join(" · ");
    const testo = `Sincronizzazione con errori: ${elenco.length > 300 ? `${elenco.slice(0, 299)}…` : elenco}`;
    return { ok: false, testo: importate ? `${testo} (importate comunque ${importate} email)` : testo };
  }
  const parti = [
    `Sincronizzazione completata: ${importate === 1 ? "1 nuova email importata" : `${importate} nuove email importate`}, ${associate === 1 ? "1 associata" : `${associate} associate`} automaticamente a un cliente.`,
  ];
  if (restanti) parti.push(restanti === 1 ? "Un'altra email verrà importata alla prossima sincronizzazione." : `Altre ${restanti} email verranno importate nelle prossime sincronizzazioni.`);
  if (risultati.some((r) => r.giaInCorso)) parti.push("Una casella era già in sincronizzazione e verrà aggiornata da quella.");
  return { ok: true, testo: parti.join(" ") };
}
