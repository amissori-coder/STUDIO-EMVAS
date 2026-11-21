"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Checkbox, Field, Select } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { pianificazioneMassiva, type PianificazioneMassivaResult } from "@/modules/adempimenti/actions";
import { cn } from "@/lib/utils";

export function PianificazioneMassivaForm({ annoCorrente, nClienti }: { annoCorrente: number; nClienti: number }) {
  const [state, action] = useActionState<PianificazioneMassivaResult, FormData>(pianificazioneMassiva, {});
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[10rem_1fr] sm:items-end">
          <Field label="Anno" htmlFor="anno-massivo">
            <Select id="anno-massivo" name="anno" defaultValue={annoCorrente}>
              <option value={annoCorrente - 1}>{annoCorrente - 1}</option>
              <option value={annoCorrente}>{annoCorrente}</option>
              <option value={annoCorrente + 1}>{annoCorrente + 1}</option>
            </Select>
          </Field>
          <Checkbox name="saltaPassate" defaultChecked label="Salta le scadenze già passate" className="min-h-10" />
        </div>
        <p className="text-xs text-slate-500">
          Genera le attività per tutti i {nClienti} clienti attivi in base al profilo fiscale e alle attivazioni per cliente. L&apos;operazione è ripetibile: le scadenze già presenti non vengono duplicate.
        </p>
        <SubmitButton pendingText="Pianificazione in corso…" disabled={nClienti === 0}>
          Pianifica tutti i clienti
        </SubmitButton>
      </form>

      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && state.righe && (
        <div className="space-y-3">
          <Alert kind="success" title={`Pianificazione ${state.anno} completata`}>
            {state.totaleCreati === 1 ? "1 attività creata" : `${state.totaleCreati} attività create`},{" "}
            {state.totaleEsistenti === 1 ? "1 già presente" : `${state.totaleEsistenti} già presenti`} su{" "}
            {state.righe.length === 1 ? "1 cliente" : `${state.righe.length} clienti`}.
          </Alert>
          {state.righe.some((r) => r.dateDiverse > 0) && (
            <Alert kind="warning">
              Alcuni clienti hanno attività aperte con una data diversa dal catalogo (colonna «Date diverse»): non sono state modificate, perché
              possono essere date concordate. Aprile dalla scheda del cliente per controllarle.
            </Alert>
          )}
          {state.righe.some((r) => r.senzaAssegnatario) && (
            <Alert kind="info">
              Per i clienti senza un referente attivo le attività nuove sono senza assegnatario: i promemoria vanno agli amministratori.
            </Alert>
          )}
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  <th className="px-3 py-2 text-right font-medium">Create</th>
                  <th className="px-3 py-2 text-right font-medium">Esistenti</th>
                  <th className="px-3 py-2 text-right font-medium">Date diverse</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.righe.map((r) => (
                  <tr key={r.clientId}>
                    <td className="px-3 py-2">
                      <Link href={`/clienti/${r.clientId}?tab=attivita`} className="text-blue-700 hover:underline">
                        {r.denominazione}
                      </Link>
                      {r.errore && <span className="ml-2 text-xs text-red-600">{r.errore}</span>}
                      {r.senzaAssegnatario && <span className="ml-2 text-xs text-amber-700">senza assegnatario</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-green-700">{r.creati}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{r.esistenti}</td>
                    <td className={cn("px-3 py-2 text-right", r.dateDiverse > 0 ? "font-medium text-amber-700" : "text-slate-300")}>{r.dateDiverse || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
