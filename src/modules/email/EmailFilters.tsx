"use client";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export interface EmailFiltersProps {
  vista: string;
  cliente?: string;
  casella?: string;
  q?: string;
  clienti: { id: string; denominazione: string }[];
  caselle: { id: string; googleEmail: string }[];
}

/** Filtri della casella unificata: form GET che si invia automaticamente al cambio dei select. */
export function EmailFilters({ vista, cliente, casella, q, clienti, caselle }: EmailFiltersProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const hasFilters = !!(cliente || casella || q);
  // Gli input sono non controllati (defaultValue): la key rimonta il form quando cambiano i filtri
  // nell'URL (Azzera, cambio tab, Indietro), altrimenti resterebbero i valori precedenti.
  const formKey = [vista, cliente ?? "", casella ?? "", q ?? ""].join("|");

  function submit() {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const params = new URLSearchParams();
    for (const [k, v] of fd.entries()) {
      const s = String(v).trim();
      if (s) params.set(k, s);
    }
    router.push(`/email?${params.toString()}`);
  }

  return (
    <form
      key={formKey}
      ref={formRef}
      className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input type="hidden" name="vista" value={vista} />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input name="q" defaultValue={q ?? ""} placeholder="Cerca per oggetto, mittente o testo…" className="pl-9" aria-label="Cerca" />
      </div>
      <Select name="cliente" defaultValue={cliente ?? ""} onChange={submit} aria-label="Cliente" className="sm:w-56">
        <option value="">Tutti i clienti</option>
        {clienti.map((c) => (
          <option key={c.id} value={c.id}>
            {c.denominazione}
          </option>
        ))}
      </Select>
      {caselle.length > 1 && (
        <Select name="casella" defaultValue={casella ?? ""} onChange={submit} aria-label="Casella" className="sm:w-52">
          <option value="">Tutte le caselle</option>
          {caselle.map((c) => (
            <option key={c.id} value={c.id}>
              {c.googleEmail}
            </option>
          ))}
        </Select>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="secondary" className="flex-1 sm:flex-none">
          Cerca
        </Button>
        {hasFilters && (
          <Button type="button" variant="ghost" onClick={() => router.push(`/email?vista=${encodeURIComponent(vista)}`)} title="Azzera filtri">
            <X className="h-4 w-4" /> Azzera
          </Button>
        )}
      </div>
    </form>
  );
}
