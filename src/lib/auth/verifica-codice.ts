import "server-only";
import { prisma } from "@/lib/db";
import { consumaCodiceRecupero, sembraCodiceRecupero, verificaTotp } from "@/lib/auth/totp";

export type EsitoCodice =
  | { ok: true; tipo: "app" | "recupero"; rimasti: number | null }
  | { ok: false; motivo: "formato" | "errato" | "gia-usato" | "non-attiva" };

/** Messaggi per l'utente; «già usato» spiega che cosa fare invece di dire solo «non valido». */
export const MESSAGGI_CODICE: Record<Exclude<EsitoCodice, { ok: true }>["motivo"], string> = {
  formato: "Inserisci le 6 cifre mostrate dall'app (oppure un codice di recupero, del tipo abcde-fghij).",
  errato: "Codice non valido. Controlla di leggere l'account «Studio EMVAS» nell'app e che l'ora del telefono sia impostata in automatico.",
  "gia-usato": "Questo codice è appena stato usato e non vale una seconda volta: attendi che l'app ne mostri uno nuovo (al massimo 30 secondi) e inserisci quello.",
  "non-attiva": "La verifica in due passaggi non è attiva per questo account.",
};

/**
 * Verifica il codice di un utente con la verifica in due passaggi attiva: il codice dell'app o, se
 * `recupero` è ammesso, un codice di recupero. Entrambi si «consumano» in modo atomico: due richieste
 * simultanee con lo stesso codice non entrano entrambe.
 */
export async function verificaCodiceUtente(userId: string, codice: string, opzioni: { recupero: boolean }): Promise<EsitoCodice> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { totpAttivo: true, totpSecret: true, totpUltimoPasso: true, totpRecupero: true } });
  if (!user?.totpAttivo || !user.totpSecret) return { ok: false, motivo: "non-attiva" };
  const pulito = codice.trim();

  if (opzioni.recupero && sembraCodiceRecupero(pulito)) {
    // confronta-e-scambia sul valore del campo: se nel frattempo è cambiato (altro codice usato) si rilegge
    let campo = user.totpRecupero;
    for (let tentativo = 0; tentativo < 3; tentativo++) {
      const r = consumaCodiceRecupero(campo, pulito);
      if (!r) return { ok: false, motivo: "errato" };
      const preso = await prisma.user.updateMany({ where: { id: userId, totpAttivo: true, totpRecupero: campo }, data: { totpRecupero: r.campo } });
      if (preso.count === 1) return { ok: true, tipo: "recupero", rimasti: r.rimasti };
      campo = (await prisma.user.findUnique({ where: { id: userId }, select: { totpRecupero: true } }))?.totpRecupero ?? null;
    }
    return { ok: false, motivo: "errato" };
  }

  const v = verificaTotp(user.totpSecret, pulito, { ultimoPasso: user.totpUltimoPasso });
  if (!v.ok) return v;
  // il passo si registra solo se è successivo all'ultimo usato: chi arriva secondo con lo stesso codice perde
  const preso = await prisma.user.updateMany({
    where: { id: userId, totpAttivo: true, OR: [{ totpUltimoPasso: null }, { totpUltimoPasso: { lt: v.passo } }] },
    data: { totpUltimoPasso: v.passo },
  });
  if (preso.count === 0) return { ok: false, motivo: "gia-usato" };
  return { ok: true, tipo: "app", rimasti: null };
}
