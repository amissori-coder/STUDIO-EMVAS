"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { apriSessione, richiedeCodice } from "@/lib/auth/accesso";
import { destinazioneDopoAccesso } from "@/lib/auth/redirect";
import { chiudiSecondoPasso, leggiSecondoPasso } from "@/lib/auth/secondo-passo";
import { MESSAGGI_CODICE, verificaCodiceUtente } from "@/lib/auth/verifica-codice";
import { checkRateLimit, clientIpFromHeaders, recordAttempt, resetRateLimit } from "@/lib/auth/rate-limit";
import { notify } from "@/lib/notifications";

export interface CodiceState {
  error?: string;
  /** la richiesta di accesso non vale più: si torna a email e password */
  ricomincia?: boolean;
}

const QUINDICI_MINUTI = 15 * 60 * 1000;
const UN_GIORNO = 24 * 60 * 60 * 1000;
/**
 * Con 6 cifre e una tolleranza di ±30 secondi ogni tentativo ha 3 probabilità su un milione: i limiti per
 * persona (5 ogni 15 minuti, 20 al giorno) tengono bassa la probabilità anche per chi conosce la password.
 */
const LIMITI = [
  { chiave: (id: string) => `codice:utente:${id}`, max: 5, finestra: QUINDICI_MINUTI },
  { chiave: (id: string) => `codice:giorno:${id}`, max: 20, finestra: UN_GIORNO },
];
const LIMITE_IP = { max: 30, finestra: QUINDICI_MINUTI };

function minuti(sec: number) {
  if (sec >= 3600) {
    const ore = Math.ceil(sec / 3600);
    return ore === 1 ? "un'ora" : `${ore} ore`;
  }
  const m = Math.max(1, Math.ceil(sec / 60));
  return m === 1 ? "1 minuto" : `${m} minuti`;
}

const RICOMINCIA: CodiceState = { error: "La richiesta di accesso è scaduta o non è più valida: inserisci di nuovo email e password.", ricomincia: true };

export async function verificaCodiceAction(_prev: CodiceState, formData: FormData): Promise<CodiceState> {
  const passo = await leggiSecondoPasso();
  if (!passo) return RICOMINCIA;
  const codice = String(formData.get("codice") ?? "").trim().slice(0, 40);
  if (!codice) return { error: "Inserisci il codice." };

  const ip = clientIpFromHeaders(await headers());
  const limiti = [...LIMITI.map((l) => ({ ...l, k: l.chiave(passo.sub) })), { k: `codice:ip:${ip}`, ...LIMITE_IP }];
  const bloccati = limiti.map((l) => checkRateLimit(l.k, l.max, l.finestra)).filter((r) => !r.ok);
  if (bloccati.length) {
    await audit({ userId: passo.sub, azione: "CODICE_BLOCCATO", entita: "User", entitaId: passo.sub, dettagli: { ip } });
    return { error: `Troppi codici errati. Per sicurezza riprova tra ${minuti(Math.max(...bloccati.map((b) => b.retryAfterSec)))}.` };
  }

  const user = await prisma.user.findUnique({ where: { id: passo.sub } });
  // password reimpostata, verifica azzerata o persona disattivata dopo la password: si ricomincia
  if (!user || !user.attivo || user.sessionVersion !== passo.sv || !richiedeCodice(user)) {
    await chiudiSecondoPasso();
    return RICOMINCIA;
  }

  const esito = await verificaCodiceUtente(user.id, codice, { recupero: true });
  if (!esito.ok) {
    // un formato sbagliato o un codice appena usato non sono tentativi di indovinare: non si contano
    if (esito.motivo === "errato") {
      for (const l of limiti) recordAttempt(l.k, l.finestra);
      const recupero = !/^\d[\d\s]*$/.test(codice);
      await audit({ userId: user.id, azione: recupero ? "CODICE_RECUPERO_FALLITO" : "CODICE_FALLITO", entita: "User", entitaId: user.id, dettagli: { ip, metodo: passo.metodo } });
      // al raggiungimento del limite la persona viene avvisata: qualcuno conosce la sua password
      if (!checkRateLimit(limiti[0]!.k, limiti[0]!.max, limiti[0]!.finestra).ok) {
        await notify({
          userId: user.id,
          tipo: "SISTEMA",
          titolo: "Codici di accesso errati",
          corpo: "Qualcuno ha inserito la tua password corretta ma più codici di verifica errati. Se non eri tu, cambia subito la password da Impostazioni.",
          link: "/impostazioni",
          email: true,
        });
      }
    }
    if (esito.motivo === "non-attiva") {
      await chiudiSecondoPasso();
      return RICOMINCIA;
    }
    return { error: MESSAGGI_CODICE[esito.motivo] };
  }

  for (const l of limiti.slice(0, 2)) resetRateLimit(l.k);
  resetRateLimit(`login:email:${user.email}`);
  await apriSessione(user);
  await audit({
    userId: user.id,
    azione: esito.tipo === "recupero" ? "LOGIN_CON_CODICE_RECUPERO" : "LOGIN_CON_CODICE",
    entita: "User",
    entitaId: user.id,
    dettagli: { metodo: passo.metodo, ip, ...(esito.tipo === "recupero" ? { rimasti: esito.rimasti } : {}) },
  });
  // con pochi codici di recupero rimasti lo staff viene portato dove può generarne di nuovi
  if (esito.tipo === "recupero" && (esito.rimasti ?? 0) <= 3 && user.ruolo !== "CLIENTE") {
    redirect(`/impostazioni?messaggio=recupero-${esito.rimasti ?? 0}#verifica-due-passaggi`);
  }
  redirect(destinazioneDopoAccesso(passo.next, user.ruolo));
}

export async function annullaCodiceAction() {
  await chiudiSecondoPasso();
  redirect("/login");
}
