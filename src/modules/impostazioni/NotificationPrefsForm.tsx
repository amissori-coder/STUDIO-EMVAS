"use client";
import { useActionState } from "react";
import { Mail, Smartphone } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PushManager } from "@/components/push/PushManager";
import { updateNotificationPrefsAction, type ImpostazioniState } from "./actions";

export function NotificationPrefsForm({
  notificaEmail,
  notificaPush,
  pushConfigured,
  mailerConfigured,
}: {
  notificaEmail: boolean;
  notificaPush: boolean;
  pushConfigured: boolean;
  mailerConfigured: boolean;
}) {
  const [state, action] = useActionState<ImpostazioniState, FormData>(updateNotificationPrefsAction, {});
  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4">
        {state.error && <Alert kind="error">{state.error}</Alert>}
        {state.ok && state.message && (
          <Alert kind="success" key={state.nonce}>
            {state.message}
          </Alert>
        )}
        <p className="text-sm text-slate-600">Le notifiche in-app (campanella) sono sempre attive. Scegli i canali aggiuntivi con cui vuoi essere avvisato.</p>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          <li className="flex items-start gap-3 px-3 py-3">
            <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            <label className="flex min-w-0 flex-1 cursor-pointer items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                  Notifiche push
                  {pushConfigured ? <Badge color="green">Configurate sul server</Badge> : <Badge color="red">Non configurate sul server</Badge>}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">Avvisi sul telefono o sul computer anche con l&apos;app chiusa (richiede l&apos;attivazione su ogni dispositivo).</span>
              </span>
              <input type="checkbox" name="notificaPush" defaultChecked={notificaPush} className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            </label>
          </li>
          <li className="flex items-start gap-3 px-3 py-3">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            <label className="flex min-w-0 flex-1 cursor-pointer items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                  Notifiche via email
                  {mailerConfigured ? <Badge color="green">SMTP configurato</Badge> : <Badge color="slate">SMTP non configurato</Badge>}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">Riepiloghi e avvisi importanti (scadenze oggi/scadute, esito assenze) alla tua email.</span>
              </span>
              <input type="checkbox" name="notificaEmail" defaultChecked={notificaEmail} className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            </label>
          </li>
        </ul>
        <div className="flex justify-end">
          <SubmitButton pendingText="Salvataggio…">Salva preferenze</SubmitButton>
        </div>
      </form>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="mb-2 text-sm font-medium text-slate-900">Questo dispositivo</p>
        <PushManager />
        <p className="mt-3 text-xs text-slate-500">
          Su iPhone e iPad le notifiche push funzionano solo dopo aver aggiunto l&apos;app alla schermata Home (Safari → Condividi → «Aggiungi alla schermata Home»), quindi
          aprendola da lì e attivando le notifiche.
        </p>
      </div>
    </div>
  );
}
