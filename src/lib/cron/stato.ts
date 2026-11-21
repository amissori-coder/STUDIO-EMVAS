/**
 * Regole del registro delle elaborazioni automatiche, senza accesso al database: quali sono, quando
 * un'esecuzione conta come riuscita e quando un'elaborazione è in ritardo. Modulo puro, provato da
 * tests/unit/registro-job.test.ts.
 */

export type NomeJob = "daily" | "gmail";
export type OrigineJob = "CRON" | "HTTP" | "MANUALE";
export type EsitoJob = "OK" | "PARZIALE" | "ERRORE";

export const JOB_PIANIFICATI: Record<NomeJob, { etichetta: string; cadenza: string; ritardoMassimoOre: number }> = {
  daily: { etichetta: "Promemoria delle scadenze e allerte assenze", cadenza: "ogni mattina alle 7:30", ritardoMassimoOre: 26 },
  gmail: { etichetta: "Importazione della posta Gmail", cadenza: "ogni 10 minuti", ritardoMassimoOre: 1 },
};

/** Dopo quanto un lucchetto non rilasciato (processo caduto a metà) si considera abbandonato. */
export const MINUTI_LUCCHETTO_ABBANDONATO = 60;

/** Esito dei job giornalieri: un errore nei promemoria è un errore dell'esecuzione, non un successo. */
export function esitoGiornalieri(r: { promemoria: object; assenze: object }): EsitoJob {
  if ("error" in r.promemoria) return "ERRORE"; // senza promemoria l'esecuzione non ha fatto il suo lavoro
  return "error" in r.assenze ? "PARZIALE" : "OK";
}

/** Esito dell'importazione: se TUTTE le caselle falliscono la posta non arriva, e non è un successo. */
export function esitoPosta(risultati: Record<string, { error?: string }>): EsitoJob {
  const caselle = Object.values(risultati);
  const fallite = caselle.filter((c) => c.error).length;
  if (caselle.length > 0 && fallite === caselle.length) return "ERRORE";
  return fallite ? "PARZIALE" : "OK";
}

export interface StatoJob {
  nome: NomeJob;
  etichetta: string;
  cadenza: string;
  /** fine dell'ultima esecuzione riuscita (OK o PARZIALE) */
  ultimaRiuscita: Date | null;
  ultimoEsito: EsitoJob | null;
  ultimoDettaglio: string | null;
  stato: "REGOLARE" | "IN_CORSO" | "IN_RITARDO" | "NON_RIUSCITA" | "MAI_ESEGUITA";
}

/**
 * Stato da mostrare. Un lucchetto rimasto preso oltre il limite non è «in corso»: il processo è caduto
 * a metà, e va mostrato come ritardo, che è proprio il caso che il registro deve far vedere.
 */
export function calcolaStato(
  nome: NomeJob,
  dati: {
    ultimaRiuscita: Date | null;
    ultimoEsito: EsitoJob | null;
    lucchettoPresoDa: Date | null;
  },
  adesso: Date,
): StatoJob["stato"] {
  const { ritardoMassimoOre } = JOB_PIANIFICATI[nome];
  if (dati.lucchettoPresoDa && adesso.getTime() - dati.lucchettoPresoDa.getTime() < MINUTI_LUCCHETTO_ABBANDONATO * 60_000) {
    return "IN_CORSO";
  }
  if (!dati.ultimaRiuscita) return dati.ultimoEsito === "ERRORE" ? "NON_RIUSCITA" : "MAI_ESEGUITA";
  if (adesso.getTime() - dati.ultimaRiuscita.getTime() > ritardoMassimoOre * 3600_000) return "IN_RITARDO";
  if (dati.ultimoEsito === "ERRORE") return "NON_RIUSCITA";
  return "REGOLARE";
}

/** Il pianificatore interno è attivo salvo ENABLE_CRON=false (o 0): un solo criterio per avvio e pannello. */
export function pianificatoreInternoAttivo(env: Record<string, string | undefined> = process.env) {
  return env.ENABLE_CRON !== "false" && env.ENABLE_CRON !== "0";
}
