import type { Prisma } from "@prisma/client";

/**
 * Chi può vedere un'email importata da Gmail.
 *
 * La sincronizzazione importa la casella di chi l'ha collegata, e una casella contiene anche posta
 * che non riguarda lo studio. Regola: un'email associata a un cliente (o a un'attività) è
 * corrispondenza dello studio ed è visibile a tutto lo staff; un'email NON associata è visibile
 * soltanto al titolare della casella da cui proviene — nessun altro, amministratori compresi.
 * È l'associazione, fatta dal titolare, a renderla condivisa.
 */
export function emailVisibile(userId: string): Prisma.EmailMessageWhereInput {
  return { OR: [{ clientId: { not: null } }, { taskId: { not: null } }, { account: { userId } }] };
}

export function puoVedereEmail(userId: string, email: { clientId: string | null; taskId: string | null; account: { userId: string } }) {
  return email.clientId !== null || email.taskId !== null || email.account.userId === userId;
}
