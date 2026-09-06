"use client";
import { useState, useTransition } from "react";
import { BellRing, Play, Users } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { runDailyJobsAction, sendTestNotificationAction, type ImpostazioniState } from "./actions";

export interface SystemStatus {
  googleConfigured: boolean;
  pushConfigured: boolean;
  mailerConfigured: boolean;
  cronEnabled: boolean;
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
        <StatoRow label="Cron interno" ok={status.cronEnabled} okLabel="Attivo" koLabel="Disattivato" hint="ENABLE_CRON: promemoria scadenze, allerta assenze e sincronizzazione Gmail" />
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

      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && state.message && (
        <Alert kind="success" key={state.nonce}>
          <p>{state.message}</p>
          {state.result && (
            <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-white/70 p-2 text-xs text-slate-800">{JSON.stringify(state.result, null, 2)}</pre>
          )}
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => run(runDailyJobsAction)} disabled={pending}>
          <Play className="h-4 w-4" /> Esegui job giornalieri ora
        </Button>
        <Button variant="outline" onClick={() => run(sendTestNotificationAction)} disabled={pending}>
          <BellRing className="h-4 w-4" /> Invia notifica di prova
        </Button>
        <Button variant="ghost" href="/team">
          <Users className="h-4 w-4" /> Gestisci il team
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        I job giornalieri inviano i promemoria delle scadenze e le allerte per i collaboratori assenti; normalmente vengono eseguiti automaticamente ogni mattina.
      </p>
    </div>
  );
}
