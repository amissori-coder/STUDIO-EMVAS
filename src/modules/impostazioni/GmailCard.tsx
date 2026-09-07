"use client";
import { useState, useTransition } from "react";
import { Link2, RefreshCw, Unlink } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { disconnectGmailAction, syncGmailAction, type ImpostazioniState } from "./actions";

export interface GmailStatus {
  googleEmail: string;
  /** etichette calcolate sul server */
  lastSyncLabel: string;
  lastSyncTitle: string | null;
  syncError: string | null;
  hasHistory: boolean;
  hasRefreshToken: boolean;
  emailCount: number;
}

const ERRORI: Record<string, string> = {
  "google-non-configurato": "L'integrazione Google non è configurata sul server.",
  "google-stato": "Sessione di collegamento Google non valida: riprova.",
  "google-utente": "Sessione scaduta durante il collegamento: accedi di nuovo e riprova.",
  "google-dominio": "L'account Google scelto non appartiene al dominio dello studio.",
  "google-errore": "Errore durante il collegamento con Google.",
  "google-negato": "Collegamento con Google annullato.",
  "google-scope": "Devi consentire l'accesso in sola lettura a Gmail nella schermata di consenso Google.",
  "google-casella-usata": "Questa casella Gmail è già collegata da un altro utente dello studio.",
};

export function GmailCard({ status, messaggio, errore }: { status: GmailStatus | null; messaggio?: string; errore?: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ImpostazioniState | null>(null);
  const run = (fn: () => Promise<ImpostazioniState>) =>
    startTransition(async () => {
      setState(await fn());
    });

  return (
    <div className="space-y-4">
      {messaggio === "gmail-collegato" && <Alert kind="success">Account Gmail collegato. Le email arriveranno nella sezione Email dopo la prima sincronizzazione.</Alert>}
      {errore && <Alert kind="error">{ERRORI[errore] ?? "Si è verificato un errore durante il collegamento con Google."}</Alert>}
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && state.message && (
        <Alert kind="success" key={state.nonce}>
          {state.message}
        </Alert>
      )}

      {!status ? (
        <>
          <p className="text-sm text-slate-600">
            Collega la tua casella Gmail per importare automaticamente le email dei clienti nella sezione Email e associarle alle schede cliente.
          </p>
          <a href="/api/auth/google?mode=connect" className={buttonClasses()}>
            <Link2 className="h-4 w-4" /> Collega Gmail
          </a>
        </>
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Casella collegata</dt>
              <dd className="mt-0.5 flex flex-wrap items-center gap-2 font-medium text-slate-900">
                <span className="break-all">{status.googleEmail}</span>
                {status.syncError ? <Badge color="red">Errore</Badge> : <Badge color="green">Attiva</Badge>}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Ultima sincronizzazione</dt>
              <dd className="mt-0.5 text-slate-900" title={status.lastSyncTitle ?? undefined}>
                {status.lastSyncLabel}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Email importate</dt>
              <dd className="mt-0.5 text-slate-900">{status.emailCount}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Modalità</dt>
              <dd className="mt-0.5 text-slate-900">{status.hasHistory ? "Incrementale (cronologia Gmail)" : "Completa alla prossima sincronizzazione"}</dd>
            </div>
          </dl>
          {status.syncError && (
            <Alert kind="warning" title="Ultimo errore di sincronizzazione">
              <p className="break-words">{status.syncError}</p>
              <p className="mt-1 text-xs">Se l&apos;errore persiste, prova a ricollegare l&apos;account.</p>
            </Alert>
          )}
          {!status.hasRefreshToken && (
            <Alert kind="warning">
              Manca il token di aggiornamento: quando il token di accesso scade la sincronizzazione si interrompe. Ricollega l&apos;account per risolvere.
            </Alert>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => run(syncGmailAction)} disabled={pending}>
              <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Sincronizza ora
            </Button>
            <a href="/api/auth/google?mode=connect" className={buttonClasses({ variant: "outline" })}>
              <Link2 className="h-4 w-4" /> Ricollega
            </a>
            <Button
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              disabled={pending}
              onClick={() => {
                if (
                  window.confirm(
                    `Scollegare ${status.googleEmail}? Le ${status.emailCount} email importate da questa casella (con le relative associazioni ai clienti) verranno rimosse dalla piattaforma. I documenti già salvati restano.`,
                  )
                )
                  run(disconnectGmailAction);
              }}
            >
              <Unlink className="h-4 w-4" /> Scollega
            </Button>
          </div>
          <p className="text-xs text-slate-500">La sincronizzazione automatica avviene periodicamente dal server; usa «Sincronizza ora» per forzarla.</p>
        </>
      )}
    </div>
  );
}
