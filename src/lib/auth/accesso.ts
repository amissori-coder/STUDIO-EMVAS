import "server-only";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { chiudiSecondoPasso } from "@/lib/auth/secondo-passo";
import type { Ruolo } from "@/lib/constants";

/**
 * Ultimo atto di ogni accesso riuscito (password, Google, codice, invito): l'ora dell'ultimo accesso si
 * scrive solo qui, cioè dopo TUTTI i passaggi richiesti, e la sessione porta la versione corrente.
 */
export async function apriSessione(user: { id: string; email: string; nome: string; ruolo: string }) {
  const aggiornato = await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() }, select: { sessionVersion: true } });
  await chiudiSecondoPasso();
  await createSession({ sub: user.id, email: user.email, nome: user.nome, ruolo: user.ruolo as Ruolo, sv: aggiornato.sessionVersion });
}

/** La verifica in due passaggi è attiva e completa (un segreto in configurazione non conta). */
export function richiedeCodice(user: { totpAttivo: boolean; totpSecret: string | null }) {
  return user.totpAttivo && !!user.totpSecret;
}
