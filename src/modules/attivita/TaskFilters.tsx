"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CATEGORIE_ADEMPIMENTO, STATI_TASK } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { buildTaskQuery, ORDINAMENTI, PERIODI, type TaskFilters as Filtri } from "@/modules/attivita/lib";

export interface OpzioneUtente {
  id: string;
  nome: string;
}
export interface OpzioneCliente {
  id: string;
  denominazione: string;
}

export function TaskFilters({
  filtri,
  utenti,
  clienti,
  userId,
}: {
  filtri: Filtri;
  utenti: OpzioneUtente[];
  clienti: OpzioneCliente[];
  userId: string;
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [ricerca, setRicerca] = useState(filtri.ricerca);
  const [pending, startTransition] = useTransition();

  const attivi = [
    filtri.stato !== "aperte",
    !!filtri.assegnatario,
    !!filtri.cliente,
    !!filtri.categoria,
    filtri.periodo !== "tutte",
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
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            applica({ ricerca: ricerca.trim() });
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            name="ricerca"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="Cerca per titolo o cliente…"
            className="pl-9 pr-9"
            aria-label="Cerca attività"
          />
          {ricerca && (
            <button
              type="button"
              onClick={() => {
                setRicerca("");
                applica({ ricerca: "" });
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
              aria-label="Cancella ricerca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
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
