import "server-only";
import { prisma } from "@/lib/db";
import {
  JOB_PIANIFICATI,
  MINUTI_LUCCHETTO_ABBANDONATO,
  calcolaStato,
  type EsitoJob,
  type NomeJob,
  type OrigineJob,
  type StatoJob,
} from "@/lib/cron/stato";

/**
 * Registro delle esecuzioni delle elaborazioni automatiche (tabella JobRun), con lucchetto contro le
 * esecuzioni sovrapposte. Ogni via di esecuzione passa di qui: il pianificatore interno, gli indirizzi
 * /api/cron/* e il pulsante in Impostazioni.
 *
 * Il lucchetto è una riga con identificativo fisso «lucchetto:<nome>» (e lo stesso valore in `nome`,
 * così non si confonde con lo storico, che usa `nome` = "daily" o "gmail"). Si prende con un solo
 * aggiornamento condizionato, quindi in modo atomico anche se due esecuzioni partono insieme.
 */

function idLucchetto(nome: NomeJob) {
  return `lucchetto:${nome}`;
}

async function prendiLucchetto(nome: NomeJob, origine: OrigineJob): Promise<boolean> {
  const id = idLucchetto(nome);
  const adesso = new Date();
  const abbandonatoPrima = new Date(adesso.getTime() - MINUTI_LUCCHETTO_ABBANDONATO * 60_000);
  const preso = await prisma.jobRun.updateMany({
    where: { id, OR: [{ finishedAt: { not: null } }, { startedAt: { lt: abbandonatoPrima } }] },
    data: { startedAt: adesso, finishedAt: null, origine },
  });
  if (preso.count === 1) return true;
  // la riga esiste ed è presa: controllarlo prima evita un errore di vincolo nei log a ogni sovrapposizione
  if (await prisma.jobRun.findUnique({ where: { id }, select: { id: true } })) return false;
  try {
    // prima esecuzione in assoluto: la chiave primaria rende la creazione esclusiva
    await prisma.jobRun.create({ data: { id, nome: id, startedAt: adesso, origine } });
    return true;
  } catch {
    return false; // la riga esiste ed è presa da un'altra esecuzione in corso
  }
}

async function rilasciaLucchetto(nome: NomeJob) {
  await prisma.jobRun.update({ where: { id: idLucchetto(nome) }, data: { finishedAt: new Date() } }).catch(() => {});
}

export type EsitoEsecuzione<T> = { eseguito: true; risultato: T; esito: EsitoJob } | { eseguito: false; motivo: string };

/**
 * Esegue un'elaborazione registrandone inizio, fine, esito e origine. Se la stessa elaborazione è già
 * in corso non fa nulla e lo dice. Un'eccezione viene registrata come ERRORE e poi rilanciata.
 */
export async function eseguiRegistrato<T>(
  nome: NomeJob,
  origine: OrigineJob,
  lavoro: () => Promise<T>,
  esito: (risultato: T) => EsitoJob,
): Promise<EsitoEsecuzione<T>> {
  if (!(await prendiLucchetto(nome, origine))) {
    return { eseguito: false, motivo: `«${JOB_PIANIFICATI[nome].etichetta}» è già in corso: riprova fra qualche minuto.` };
  }
  const riga = await prisma.jobRun.create({ data: { nome, origine } });
  try {
    const risultato = await lavoro();
    const e = esito(risultato);
    await prisma.jobRun.update({
      where: { id: riga.id },
      data: { finishedAt: new Date(), esito: e, dettagli: JSON.stringify(risultato).slice(0, 4000) },
    });
    return { eseguito: true, risultato, esito: e };
  } catch (err) {
    await prisma.jobRun
      .update({ where: { id: riga.id }, data: { finishedAt: new Date(), esito: "ERRORE", dettagli: String(err).slice(0, 4000) } })
      .catch(() => {});
    throw err;
  } finally {
    await rilasciaLucchetto(nome);
  }
}

/** Stato di ogni elaborazione, per il pannello Impostazioni e per /api/health. */
export async function statoJob(adesso = new Date()): Promise<StatoJob[]> {
  const nomi = Object.keys(JOB_PIANIFICATI) as NomeJob[];
  return Promise.all(
    nomi.map(async (nome) => {
      const [riuscita, ultima, lucchetto] = await Promise.all([
        prisma.jobRun.findFirst({ where: { nome, esito: { in: ["OK", "PARZIALE"] } }, orderBy: { startedAt: "desc" } }),
        prisma.jobRun.findFirst({ where: { nome, finishedAt: { not: null } }, orderBy: { startedAt: "desc" } }),
        prisma.jobRun.findUnique({ where: { id: idLucchetto(nome) }, select: { startedAt: true, finishedAt: true } }),
      ]);
      const ultimoEsito = (ultima?.esito ?? null) as EsitoJob | null;
      const ultimaRiuscita = riuscita?.finishedAt ?? null;
      return {
        nome,
        etichetta: JOB_PIANIFICATI[nome].etichetta,
        cadenza: JOB_PIANIFICATI[nome].cadenza,
        ultimaRiuscita,
        ultimoEsito,
        ultimoDettaglio: ultimoEsito === "ERRORE" ? (ultima?.dettagli ?? null) : null,
        stato: calcolaStato(nome, { ultimaRiuscita, ultimoEsito, lucchettoPresoDa: lucchetto && !lucchetto.finishedAt ? lucchetto.startedAt : null }, adesso),
      };
    }),
  );
}
