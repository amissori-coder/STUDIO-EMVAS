/**
 * Regole dei promemoria di scadenza, senza accesso al database: chi riceve l'avviso, con che
 * testo e fino a quanti giorni avanti guardare. Modulo puro, provato da tests/unit/promemoria.test.ts.
 */

export type LivelloPromemoria = "PREAVVISO" | "DOMANI" | "OGGI" | "SCADUTA";

/** Orizzonte minimo della ricerca (comportamento storico) e massimo preavviso ammesso. */
export const ORIZZONTE_MINIMO_GIORNI = 60;
export const MAX_GIORNI_PREAVVISO = 365;

/** "1 giorno", "3 giorni". */
export function giorni(n: number) {
  return n === 1 ? "1 giorno" : `${n} giorni`;
}

/** Livello di promemoria dovuto oggi, o null se non ne è dovuto nessuno. */
export function livelloPromemoria(diff: number, giorniPreavviso: number | null | undefined): LivelloPromemoria | null {
  const preavviso = giorniPreavviso ?? 7;
  if (diff < 0) return "SCADUTA";
  if (diff === 0) return "OGGI";
  if (diff === 1) return "DOMANI";
  if (preavviso >= 2 && diff <= preavviso) return "PREAVVISO";
  return null;
}

/**
 * Fino a quanti giorni avanti cercare le attività: copre il preavviso più lungo realmente impostato
 * (un adempimento con 120 giorni di preavviso deve entrare nella ricerca a 120 giorni, non a 60).
 */
export function orizzontePromemoria(maxPreavviso: number | null | undefined) {
  const richiesto = maxPreavviso ?? 0;
  return Math.min(MAX_GIORNI_PREAVVISO, Math.max(ORIZZONTE_MINIMO_GIORNI, richiesto));
}

export function testoPromemoria(livello: LivelloPromemoria, diff: number, titolo: string) {
  switch (livello) {
    case "PREAVVISO":
      return { tipo: "SCADENZA_VICINA" as const, titolo: `Scade tra ${giorni(diff)}: ${titolo}` };
    case "DOMANI":
      return { tipo: "SCADENZA_VICINA" as const, titolo: `Scade domani: ${titolo}` };
    case "OGGI":
      return { tipo: "SCADENZA_OGGI" as const, titolo: `Scade oggi: ${titolo}` };
    case "SCADUTA":
      return {
        tipo: "SCADUTA" as const,
        titolo: diff === -1 ? `Scaduta ieri: ${titolo}` : `Scaduta da ${giorni(-diff)}: ${titolo}`,
      };
  }
}

interface Persona {
  id: string;
  nome: string;
  attivo: boolean;
}

export interface SituazioneAttivita {
  assegnatario: Persona | null;
  /** null se l'attività non ha cliente */
  cliente: { attivo: boolean; referente: Persona | null } | null;
}

/**
 * Chi deve ricevere il promemoria. L'avviso non deve MAI perdersi in silenzio: se l'assegnatario
 * manca o non è più attivo ricade sul referente del cliente e, in mancanza, sugli amministratori.
 *
 * Eccezione: un cliente archiviato non fa partire ricadute. Le sue attività assegnate continuano ad
 * avvisare l'assegnatario (come sempre), ma quelle senza un assegnatario attivo non devono riversare
 * avvisi sugli amministratori per un rapporto che lo studio ha chiuso.
 */
export type Destinatario =
  | { tipo: "ASSEGNATARIO"; userId: string }
  | { tipo: "REFERENTE"; userId: string; prefisso: string; motivo: string }
  | { tipo: "AMMINISTRATORI"; prefisso: string; motivo: string }
  | { tipo: "NESSUNO"; motivo: string };

export function destinatarioPromemoria(s: SituazioneAttivita): Destinatario {
  const { assegnatario, cliente } = s;
  if (assegnatario?.attivo) return { tipo: "ASSEGNATARIO", userId: assegnatario.id };

  const daRiassegnare = !!assegnatario; // c'è, ma non è più attivo
  const prefisso = daRiassegnare ? "Da riassegnare" : "Da assegnare";
  const causa = daRiassegnare ? `Assegnatario non più attivo (${assegnatario.nome})` : "Attività non assegnata";

  if (cliente && !cliente.attivo) {
    return { tipo: "NESSUNO", motivo: `${causa}, cliente archiviato` };
  }

  const referente = cliente?.referente ?? null;
  if (referente?.attivo) {
    return {
      tipo: "REFERENTE",
      userId: referente.id,
      prefisso,
      motivo: `${causa}: ti arriva perché sei il referente del cliente. Va ${daRiassegnare ? "riassegnata" : "assegnata"} a un collaboratore.`,
    };
  }

  let senzaReferente = "";
  if (cliente) {
    senzaReferente = referente
      ? ` e referente del cliente non più attivo (${referente.nome})`
      : " e cliente senza referente";
  }
  return {
    tipo: "AMMINISTRATORI",
    prefisso,
    motivo: `${causa}${senzaReferente}: va ${daRiassegnare ? "riassegnata" : "assegnata"} a un collaboratore.`,
  };
}

/** Testo per la scheda attività: a chi arriverà il promemoria, detto come lo direbbe il programma. */
export function descriviDestinatario(s: SituazioneAttivita): string {
  const d = destinatarioPromemoria(s);
  switch (d.tipo) {
    case "ASSEGNATARIO":
      return "all'assegnatario";
    case "REFERENTE":
      return "al referente del cliente";
    case "AMMINISTRATORI":
      return "agli amministratori dello studio";
    case "NESSUNO":
      return "a nessuno (cliente archiviato e nessun assegnatario attivo)";
  }
}
