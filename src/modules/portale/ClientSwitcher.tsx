"use client";
import { useRef } from "react";
import { Building2 } from "lucide-react";
import { selectPortalClientAction } from "./actions";

/** Selettore del cliente per gli utenti collegati a più aziende: al cambio invia il form (server action + cookie). */
export function ClientSwitcher({ clients, currentId }: { clients: { id: string; denominazione: string }[]; currentId: string }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={selectPortalClientAction} className="flex items-center gap-1.5">
      <Building2 className="hidden h-4 w-4 text-slate-400 sm:block" aria-hidden="true" />
      <select
        name="clientId"
        defaultValue={currentId}
        onChange={() => form.current?.requestSubmit()}
        aria-label="Azienda"
        className="h-10 max-w-[11rem] rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 sm:max-w-[16rem]"
      >
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.denominazione}
          </option>
        ))}
      </select>
    </form>
  );
}
