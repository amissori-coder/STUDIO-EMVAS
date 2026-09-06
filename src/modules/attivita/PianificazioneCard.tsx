"use client";
import { useState, useTransition } from "react";
import { Check, Minus, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Checkbox, Select } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { CATEGORIE_ADEMPIMENTO, RICORRENZE } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import { anteprimaCliente, impostaOverride, pianificaCliente, type PianificazioneResult } from "@/modules/attivita/actions";
import type { AnteprimaRiga } from "@/modules/attivita/pianificazione";

type Override = "auto" | "attiva" | "disattiva";

function overrideValue(o: boolean | null): Override {
  return o === null ? "auto" : o ? "attiva" : "disattiva";
}

export function PianificazioneCard({ clientId, annoIniziale, righeIniziali }: { clientId: string; annoIniziale: number; righeIniziali: AnteprimaRiga[] }) {
  const annoCorrente = new Date().getFullYear();
  const [anno, setAnno] = useState(annoIniziale);
  const [righe, setRighe] = useState(righeIniziali);
  const [saltaPassate, setSaltaPassate] = useState(true);
  const [esito, setEsito] = useState<PianificazioneResult | null>(null);
  const [mostraTutti, setMostraTutti] = useState(false);
  const [pending, startTransition] = useTransition();

  function applica(r: PianificazioneResult) {
    if (r.righe) setRighe(r.righe);
    if (r.anno) setAnno(r.anno);
    setEsito(r);
  }

  function cambiaAnno(nuovo: number) {
    startTransition(async () => {
      const r = await anteprimaCliente(clientId, nuovo);
      if (r.ok) {
        setEsito(null);
        applica(r);
      } else setEsito(r);
    });
  }

  function cambiaOverride(templateId: string, valore: Override) {
    startTransition(async () => applica(await impostaOverride(clientId, templateId, valore, anno)));
  }

  function genera() {
    startTransition(async () => applica(await pianificaCliente(clientId, anno, saltaPassate)));
  }

  const daGenerare = righe.filter((r) => r.generare);
  const totScadenze = daGenerare.reduce((s, r) => s + r.nScadenze, 0);
  const totEsistenti = daGenerare.reduce((s, r) => s + r.esistenti, 0);
  const visibili = mostraTutti ? righe : righe.filter((r) => r.generare || r.applicabile || r.override !== null || r.esistenti > 0);
  const nascoste = righe.length - visibili.length;
  const anni = Array.from(new Set([annoCorrente - 1, annoCorrente, annoCorrente + 1, anno])).sort();

  return (
    <Card>
      <CardHeader
        title="Pianificazione adempimenti"
        description="Adempimenti applicabili in base al profilo fiscale del cliente. Puoi forzarne l'attivazione o la disattivazione."
        actions={
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Anno
            <Select value={anno} onChange={(e) => cambiaAnno(Number(e.target.value))} className="w-28" aria-label="Anno di pianificazione" disabled={pending}>
              {anni.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </label>
        }
      />
      <CardBody className={cn("space-y-4", pending && "opacity-70")}>
        {esito?.error && <Alert kind="error">{esito.error}</Alert>}
        {esito?.ok && esito.creati !== undefined && (
          <Alert kind={esito.creati > 0 ? "success" : "info"} title={`Pianificazione ${esito.anno} eseguita`}>
            {esito.creati} attività create, {esito.esistenti} già presenti.
          </Alert>
        )}

        <div className="flex flex-col gap-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-blue-900">
            <p className="font-medium">
              {daGenerare.length} adempimenti da generare per il {anno} · {totScadenze} scadenze
              {totEsistenti > 0 && <span className="font-normal text-blue-700"> ({totEsistenti} già create)</span>}
            </p>
            <Checkbox label="Salta le scadenze già passate" checked={saltaPassate} onChange={(e) => setSaltaPassate(e.target.checked)} className="mt-1 min-h-8 text-blue-900" />
          </div>
          <Button type="button" onClick={genera} disabled={pending || daGenerare.length === 0}>
            {pending ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            Genera attività {anno}
          </Button>
        </div>

        {/* Tabella (desktop) */}
        <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Adempimento</th>
                <th className="px-3 py-2 text-center font-medium">Applicabile</th>
                <th className="px-3 py-2 text-center font-medium">Scadenze</th>
                <th className="px-3 py-2 text-center font-medium">Generate</th>
                <th className="px-3 py-2 font-medium">Attivazione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibili.map((r) => (
                <tr key={r.templateId} className={cn(!r.generare && "text-slate-500", !r.attivo && "opacity-60")}>
                  <td className="px-3 py-2">
                    <p className={cn("font-medium", r.generare ? "text-slate-900" : "text-slate-600")}>{r.nome}</p>
                    <p className="text-xs text-slate-500">
                      {CATEGORIE_ADEMPIMENTO[r.categoria as keyof typeof CATEGORIE_ADEMPIMENTO] ?? r.categoria} · {RICORRENZE[r.ricorrenza as keyof typeof RICORRENZE] ?? r.ricorrenza}
                      {r.soloSuRichiesta && " · solo su richiesta"}
                      {!r.attivo && " · disattivato nel catalogo"}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.applicabile ? <Check className="mx-auto h-4 w-4 text-green-600" aria-label="Sì" /> : <Minus className="mx-auto h-4 w-4 text-slate-300" aria-label="No" />}
                  </td>
                  <td className="px-3 py-2 text-center" title={r.scadenze.map((s) => formatDate(s)).join(", ")}>
                    {r.nScadenze}
                  </td>
                  <td className="px-3 py-2 text-center">{r.esistenti > 0 ? <Badge color="green">{r.esistenti}</Badge> : <span className="text-slate-300">–</span>}</td>
                  <td className="px-3 py-2">
                    <OverrideSelect value={overrideValue(r.override)} onChange={(v) => cambiaOverride(r.templateId, v)} disabled={pending || !r.attivo} generare={r.generare} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Elenco (mobile) */}
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 md:hidden">
          {visibili.map((r) => (
            <li key={r.templateId} className={cn("space-y-2 px-3 py-3", !r.attivo && "opacity-60")}>
              <div className="flex items-start gap-2">
                {r.applicabile ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> : <Minus className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />}
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", r.generare ? "text-slate-900" : "text-slate-600")}>{r.nome}</p>
                  <p className="text-xs text-slate-500">
                    {RICORRENZE[r.ricorrenza as keyof typeof RICORRENZE] ?? r.ricorrenza} · {r.nScadenze} scadenze
                    {r.esistenti > 0 && ` · ${r.esistenti} generate`}
                    {r.soloSuRichiesta && " · solo su richiesta"}
                  </p>
                </div>
              </div>
              <OverrideSelect value={overrideValue(r.override)} onChange={(v) => cambiaOverride(r.templateId, v)} disabled={pending || !r.attivo} generare={r.generare} />
            </li>
          ))}
        </ul>

        {nascoste > 0 && (
          <button type="button" onClick={() => setMostraTutti(true)} className="text-sm text-blue-700 hover:underline">
            Mostra anche i {nascoste} adempimenti non applicabili a questo cliente
          </button>
        )}
        {mostraTutti && (
          <button type="button" onClick={() => setMostraTutti(false)} className="text-sm text-slate-500 hover:underline">
            Nascondi gli adempimenti non applicabili
          </button>
        )}
      </CardBody>
    </Card>
  );
}

function OverrideSelect({ value, onChange, disabled, generare }: { value: Override; onChange: (v: Override) => void; disabled: boolean; generare: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Select value={value} onChange={(e) => onChange(e.target.value as Override)} disabled={disabled} className="h-10 w-full sm:w-56" aria-label="Attivazione per il cliente">
        <option value="auto">Automatico (da profilo)</option>
        <option value="attiva">Attivato</option>
        <option value="disattiva">Disattivato</option>
      </Select>
      {/* wrapper: la classe base `inline-flex` di Badge prevarrebbe su `hidden` */}
      <span className="hidden shrink-0 sm:inline-flex">
        <Badge color={generare ? "green" : "slate"}>{generare ? "Genera" : "Non genera"}</Badge>
      </span>
    </div>
  );
}
