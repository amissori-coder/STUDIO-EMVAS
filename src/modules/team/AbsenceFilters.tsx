"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, List, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { STATI_ASSENZA } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { buildAbsenceQuery, labelMese, shiftMese, type AbsenceFilters as Filtri } from "./absence-filters";

export function AbsenceFilters({ filtri, utenti }: { filtri: Filtri; utenti: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const now = new Date();
  const meseCorrente = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  function applica(patch: Partial<Filtri>) {
    startTransition(() => router.push(`/team/assenze${buildAbsenceQuery({ ...filtri, ...patch })}`));
  }
  const attivi = !!filtri.utente || !!filtri.stato;

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4", pending && "opacity-70")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-2 sm:justify-start">
          <Button variant="outline" size="icon" onClick={() => applica({ mese: shiftMese(filtri.mese, -1) })} aria-label="Mese precedente">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="text-base font-semibold text-slate-900">{labelMese(filtri.mese)}</p>
            {filtri.mese !== meseCorrente && (
              <button type="button" onClick={() => applica({ mese: meseCorrente })} className="text-xs text-blue-700 hover:underline">
                Torna a oggi
              </button>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={() => applica({ mese: shiftMese(filtri.mese, 1) })} aria-label="Mese successivo">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <div className="inline-flex self-start rounded-lg border border-slate-200 p-0.5 sm:self-auto" role="tablist" aria-label="Vista">
          <button
            type="button"
            role="tab"
            aria-selected={filtri.vista === "elenco"}
            onClick={() => applica({ vista: "elenco" })}
            className={cn("inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium", filtri.vista === "elenco" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}
          >
            <List className="h-4 w-4" /> Elenco
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filtri.vista === "calendario"}
            onClick={() => applica({ vista: "calendario" })}
            className={cn("inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium", filtri.vista === "calendario" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}
          >
            <CalendarDays className="h-4 w-4" /> Calendario
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-xs font-medium text-slate-600">
          Collaboratore
          <Select value={filtri.utente} onChange={(e) => applica({ utente: e.target.value })} className="mt-1">
            <option value="">Tutti</option>
            {utenti.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Stato
          <Select value={filtri.stato} onChange={(e) => applica({ stato: e.target.value })} className="mt-1">
            <option value="">Tutti gli stati</option>
            {Object.entries(STATI_ASSENZA).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </label>
        {attivi && (
          <Button variant="ghost" size="sm" className="h-10" onClick={() => applica({ utente: "", stato: "" })}>
            <X className="h-4 w-4" /> Azzera filtri
          </Button>
        )}
      </div>
    </div>
  );
}
