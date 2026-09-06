"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export function CalendarioFiltri({
  mese,
  giorno,
  assegnatario,
  cliente,
  utenti,
  clienti,
  userId,
}: {
  mese: string;
  giorno: string;
  assegnatario: string;
  cliente: string;
  utenti: { id: string; nome: string }[];
  clienti: { id: string; denominazione: string }[];
  userId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function applica(patch: { assegnatario?: string; cliente?: string }) {
    const p = new URLSearchParams();
    p.set("mese", mese);
    if (giorno) p.set("giorno", giorno);
    const a = patch.assegnatario ?? assegnatario;
    const c = patch.cliente ?? cliente;
    if (a) p.set("assegnatario", a);
    if (c) p.set("cliente", c);
    startTransition(() => router.push(`/scadenzario?${p.toString()}`));
  }

  return (
    <div className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3", pending && "opacity-70")}>
      <Select value={assegnatario} onChange={(e) => applica({ assegnatario: e.target.value })} aria-label="Assegnatario">
        <option value="">Tutti gli assegnatari</option>
        <option value={userId}>Le mie attività</option>
        {utenti
          .filter((u) => u.id !== userId)
          .map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
      </Select>
      <Select value={cliente} onChange={(e) => applica({ cliente: e.target.value })} aria-label="Cliente">
        <option value="">Tutti i clienti</option>
        {clienti.map((c) => (
          <option key={c.id} value={c.id}>
            {c.denominazione}
          </option>
        ))}
      </Select>
    </div>
  );
}
