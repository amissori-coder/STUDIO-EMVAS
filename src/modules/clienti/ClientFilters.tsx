"use client";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { REGIMI_FISCALI, TIPI_SOGGETTO } from "@/lib/constants";

export interface FilterValues {
  q: string;
  regime: string;
  tipo: string;
  referente: string;
  stato: string;
}

export function ClientFilters({ values, staff }: { values: FilterValues; staff: { id: string; nome: string }[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const hasFilters = !!(values.q || values.regime || values.tipo || values.referente || (values.stato && values.stato !== "attivi"));

  const submit = () => {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const sp = new URLSearchParams();
    for (const [k, v] of fd.entries()) {
      const s = String(v).trim();
      if (!s) continue;
      if (k === "stato" && s === "attivi") continue;
      sp.set(k, s);
    }
    const qs = sp.toString();
    router.push(qs ? `/clienti?${qs}` : "/clienti");
  };

  return (
    <form
      ref={formRef}
      method="get"
      action="/clienti"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))_auto]"
    >
      <div className="relative col-span-2 lg:col-span-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="search"
          name="q"
          defaultValue={values.q}
          placeholder="Cerca denominazione, P. IVA, codice fiscale, email…"
          className="pl-9"
          aria-label="Cerca clienti"
        />
      </div>
      <Select name="tipo" defaultValue={values.tipo} onChange={submit} aria-label="Tipo soggetto">
        <option value="">Tipo: tutti</option>
        {Object.entries(TIPI_SOGGETTO).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </Select>
      <Select name="regime" defaultValue={values.regime} onChange={submit} aria-label="Regime fiscale">
        <option value="">Regime: tutti</option>
        {Object.entries(REGIMI_FISCALI).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </Select>
      <Select name="referente" defaultValue={values.referente} onChange={submit} aria-label="Referente">
        <option value="">Referente: tutti</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome}
          </option>
        ))}
        <option value="nessuno">Senza referente</option>
      </Select>
      <Select name="stato" defaultValue={values.stato || "attivi"} onChange={submit} aria-label="Stato">
        <option value="attivi">Attivi</option>
        <option value="archiviati">Archiviati</option>
        <option value="tutti">Tutti</option>
      </Select>
      <div className="col-span-2 flex gap-2 lg:col-span-1">
        <Button type="submit" variant="secondary" className="flex-1 lg:flex-none">
          <Search className="h-4 w-4" /> Cerca
        </Button>
        {hasFilters && (
          <Button variant="ghost" href="/clienti" title="Azzera filtri" className="flex-1 lg:flex-none">
            <X className="h-4 w-4" /> Azzera
          </Button>
        )}
      </div>
    </form>
  );
}
