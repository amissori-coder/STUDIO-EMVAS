"use client";
import { useState, useTransition } from "react";
import { BellRing, Play, Users } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { runDailyJobsAction, sendTestNotificationAction, type ImpostazioniState } from "./actions";

export interface ElaborazioneVista {
  nome: string;
  etichetta: string;
  cadenza: string;
  stato: "REGOLARE" | "IN_CORSO" | "IN_RITARDO" | "NON_RIUSCITA" | "MAI_ESEGUITA";
  /** calcolata sul server, come le altre date relative */
  ultimaRiuscitaLabel: string | null;
  dettaglio: string | null;
}

const STATI_ELABORAZIONE: Record<ElaborazioneVista["stato"], { testo: string; colore: "green" | "blue" | "red" | "yellow" }> = {
  REGOLARE: { testo: "Regolare", colore: "green" },
  IN_CORSO: { testo: "In corso", colore: "blue" },
  IN_RITARDO: { testo: "In ritardo", colore: "red" },
  NON_RIUSCITA: { testo: "Ultima non riuscita", colore: "red" },
  MAI_ESEGUITA: { testo: "Mai eseguita", colore: "yellow" },
};

export interface SystemStatus {
  googleConfigured: boolean;
  pushConfigured: boolean;
  mailerConfigured: boolean;
  cronEnabled: boolean;
  elaborazioni: ElaborazioneVista[];
  appUrl: string;
  version: string;
  nodeEnv: string;
}

function StatoRow({ label, ok, okLabel = "Configurato", koLabel = "Non configurato", hint }: { label: string; ok: boolean; okLabel?: string; koLabel?: string; hint?: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm text-slate-800">{label}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      <Badge color={ok ? "green" : "slate"}>{ok ? okLabel : koLabel}</Badge>
    </li>
  );
}

export function SystemCard({ status }: { status: SystemStatus }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ImpostazioniState | null>(null);
  const run = (fn: () => Promise<ImpostazioniState>) =>
    startTransition(async () => {
      setState(await fn());
    });

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-slate-100">
        <StatoRow label="Accesso Google / Gmail" ok={status.googleConfigured} hint="GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET" />
        <StatoRow label="Notifiche push" ok={status.pushConfigured} hint="Chiavi VAPID (npm run vapid)" />
        <StatoRow label="Email SMTP" ok={status.mailerConfigured} hint="SMTP_HOST e SMTP_FROM" />
        <StatoRow
          label="Pianificatore interno"
          ok={status.cronEnabled}
          okLabel="Acceso"
          koLabel="Spento"
          hint={status.cronEnabled ? "Avvia da solo le elaborazioni qui sotto" : "ENABLE_CRON=false: le elaborazioni vanno avviate da un pianificatore esterno"}
        />
        <li className="flex items-center justify-between gap-3 py-2">
          <p className="text-sm text-slate-800">APP_URL</p>
          <span className="break-all text-right font-mono text-xs text-slate-600">{status.appUrl}</span>
        </li>
        <li className="flex items-center justify-between gap-3 py-2">
          <p className="text-sm text-slate-800">Versione</p>
          <span className="font-mono text-xs text-slate-600">
            {status.version} · {status.nodeEnv}
          </span>
        </li>
      </ul>

      <div>
        <p className="text-sm font-medium text-slate-800">Elaborazioni automatiche</p>
        {status.elaborazioni.some((e) => e.stato === "IN_RITARDO" || e.stato === "NON_RIUSCITA") && (
          <Alert kind="error" className="mt-2">
            Un&apos;elaborazione automatica è in ritardo o non è riuscita: finché non riparte, promemoria o posta possono non arrivare.
          </Alert>
        )}
        <ul className="mt-1 divide-y divide-slate-100">
          {status.elaborazioni.map((e) => (
            <li key={e.nome} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm text-slate-800">{e.etichetta}</p>
                <p className="text-xs text-slate-500">
                  {e.cadenza} · {e.ultimaRiuscitaLabel ? `ultima riuscita ${e.ultimaRiuscitaLabel}` : "nessuna esecuzione riuscita"}
                </p>
                {e.dettaglio && <p className="mt-0.5 break-words text-xs text-red-600">{e.dettaglio}</p>}
              </div>
              <Badge color={STATI_ELABORAZIONE[e.stato].colore}>{STATI_ELABORAZIONE[e.stato].testo}</Badge>
            </li>
          ))}
        </ul>
      </div>

      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && state.message && (
        <Alert kind="success" key={state.nonce}>
          {state.message}
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => run(runDailyJobsAction)} disabled={pending}>
          <Play className="h-4 w-4" /> Invia ora promemoria e allerte
        </Button>
        <Button variant="outline" onClick={() => run(sendTestNotificationAction)} disabled={pending}>
          <BellRing className="h-4 w-4" /> Invia notifica di prova
        </Button>
        <Button variant="ghost" href="/team">
          <Users className="h-4 w-4" /> Gestisci il team
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        Promemoria delle scadenze e allerte per i collaboratori assenti partono da soli ogni mattina; il pulsante serve a mandarli subito, senza
        duplicare quelli già inviati.
      </p>
    </div>
  );
}
