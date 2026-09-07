"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CATEGORIE_ADEMPIMENTO, STATI_TASK } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import { buildTaskQuery, ORDINAMENTI, PERIODI, type TaskFilters as Filtri } from "@/modules/attivita/lib";

export interface OpzioneUtente {
  id: string;
  nome: string;
}
export interface OpzioneCliente {
  id: string;
  denominazione: string;
}

/** Campo di ricerca: stato locale rimontato (key) quando cambia la ricerca in URL, così non resta testo "fantasma" dopo Azzera filtri o le card di riepilogo. */
function RicercaForm({ iniziale, onApplica }: { iniziale: string; onApplica: (ricerca: string) => void }) {
  const [ricerca, setRicerca] = useState(iniziale);
  return (
    <form
      className="relative flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        onApplica(ricerca.trim());
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input name="ricerca" value={ricerca} onChange={(e) => setRicerca(e.target.value)} placeholder="Cerca per titolo o cliente…" className="pl-9 pr-9" aria-label="Cerca attività" />
      {ricerca && (
        <button
          type="button"
          onClick={() => {
            setRicerca("");
            onApplica("");
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
          aria-label="Cancella ricerca"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}

export function TaskFilters({
  filtri,
  utenti,
  clienti,
  userId,
  templateNome = null,
}: {
  filtri: Filtri;
  utenti: OpzioneUtente[];
  clienti: OpzioneCliente[];
  userId: string;
  /** Nome dell'adempimento quando l'elenco è filtrato per template (link dal catalogo). */
  templateNome?: string | null;
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [pending, startTransition] = useTransition();

  const attivi = [
    filtri.stato !== "aperte",
    !!filtri.assegnatario,
    !!filtri.cliente,
    !!filtri.categoria,
    !!filtri.template,
    !!filtri.anno,
    filtri.periodo !== "tutte",
    !!filtri.da || !!filtri.a,
    !!filtri.ricerca,
    filtri.ordina !== "scadenza",
  ].filter(Boolean).length;

  function applica(patch: Partial<Filtri>) {
    const next = { ...filtri, ...patch, pagina: 1 };
    startTransition(() => router.push(`/attivita${buildTaskQuery(next)}`));
  }

  const assegnatarioValue = filtri.assegnatario === userId ? "me" : filtri.assegnatario;

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", pending && "opacity-70")}>
      <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
        <RicercaForm key={filtri.ricerca} iniziale={filtri.ricerca} onApplica={(ricerca) => applica({ ricerca })} />
        <Button type="button" variant={aperto ? "secondary" : "outline"} onClick={() => setAperto((v) => !v)} className="md:hidden" aria-expanded={aperto}>
          <SlidersHorizontal className="h-4 w-4" />
          Filtri
          {attivi > 0 && <span className="rounded-full bg-blue-600 px-1.5 text-[11px] text-white">{attivi}</span>}
        </Button>
      </div>
      <div className={cn("grid grid-cols-1 gap-3 border-t border-slate-100 px-3 py-3 sm:grid-cols-2 sm:px-4 md:grid lg:grid-cols-6", aperto ? "grid" : "hidden md:grid")}>
        <label className="text-xs font-medium text-slate-600">
          Stato
          <Select value={filtri.stato} onChange={(e) => applica({ stato: e.target.value as Filtri["stato"] })} className="mt-1">
            <option value="aperte">Aperte (da fare + in corso)</option>
            <option value="tutte">Tutte</option>
            {Object.entries(STATI_TASK).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Assegnatario
          <Select value={assegnatarioValue} onChange={(e) => applica({ assegnatario: e.target.value })} className="mt-1">
            <option value="">Chiunque</option>
            <option value="me">Le mie</option>
            <option value="nessuno">Non assegnate</option>
            {utenti
              .filter((u) => u.id !== userId)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
          </Select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Cliente
          <Select value={filtri.cliente} onChange={(e) => applica({ cliente: e.target.value })} className="mt-1">
            <option value="">Tutti i clienti</option>
            {clienti.map((c) => (
              <option key={c.id} value={c.id}>
                {c.denominazione}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Categoria
          <Select value={filtri.categoria} onChange={(e) => applica({ categoria: e.target.value })} className="mt-1">
            <option value="">Tutte le categorie</option>
            {Object.entries(CATEGORIE_ADEMPIMENTO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Periodo
          <Select value={filtri.periodo} onChange={(e) => applica({ periodo: e.target.value as Filtri["periodo"] })} className="mt-1">
            {Object.entries(PERIODI).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Ordina per
          <Select value={filtri.ordina} onChange={(e) => applica({ ordina: e.target.value as Filtri["ordina"] })} className="mt-1">
            {Object.entries(ORDINAMENTI).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </label>
        {(filtri.template || filtri.anno || filtri.da || filtri.a) && (
          <div className="flex flex-wrap items-center gap-2 text-xs sm:col-span-2 lg:col-span-6">
            {(filtri.da || filtri.a) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 font-medium text-orange-800 ring-1 ring-inset ring-orange-200">
                Scadenza {filtri.da ? `dal ${formatDate(filtri.da)}` : ""} {filtri.a ? `entro il ${formatDate(filtri.a)}` : ""}
                {!filtri.da && filtri.a ? " (incluse le scadute)" : ""}
                <button type="button" onClick={() => applica({ da: "", a: "" })} className="rounded-full p-0.5 hover:bg-orange-100" aria-label="Rimuovi intervallo di scadenza">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
            {filtri.template && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                Adempimento: {templateNome ?? "…"}
                <button type="button" onClick={() => applica({ template: "" })} className="rounded-full p-0.5 hover:bg-blue-100" aria-label="Rimuovi filtro adempimento">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
            {filtri.anno && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                Anno: {filtri.anno}
                <button type="button" onClick={() => applica({ anno: null })} className="rounded-full p-0.5 hover:bg-blue-100" aria-label="Rimuovi filtro anno">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
          </div>
        )}
        {attivi > 0 && (
          <div className="sm:col-span-2 lg:col-span-6">
            <Button type="button" variant="ghost" size="sm" onClick={() => startTransition(() => router.push("/attivita"))}>
              <X className="h-4 w-4" /> Azzera filtri
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
