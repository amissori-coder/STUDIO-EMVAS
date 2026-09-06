"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Checkbox, Field, Select } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { pianificazioneMassiva, type PianificazioneMassivaResult } from "@/modules/adempimenti/actions";

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
            {state.totaleCreati} attività create, {state.totaleEsistenti} già presenti su {state.righe.length} clienti.
          </Alert>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  <th className="px-3 py-2 text-right font-medium">Create</th>
                  <th className="px-3 py-2 text-right font-medium">Esistenti</th>
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
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-green-700">{r.creati}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{r.esistenti}</td>
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
