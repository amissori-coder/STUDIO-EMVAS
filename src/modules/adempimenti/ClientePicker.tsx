"use client";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";

/** Selettore cliente che porta alla tab Attività della scheda (anteprima pianificazione). */
export function ClientePicker({ clienti }: { clienti: { id: string; denominazione: string }[] }) {
  const [id, setId] = useState(clienti[0]?.id ?? "");
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Select value={id} onChange={(e) => setId(e.target.value)} aria-label="Cliente" className="sm:flex-1">
        {clienti.map((c) => (
          <option key={c.id} value={c.id}>
            {c.denominazione}
          </option>
        ))}
      </Select>
      <Button href={id ? `/clienti/${id}?tab=attivita` : "/clienti"} variant="outline">
        <ExternalLink className="h-4 w-4" /> Apri anteprima
      </Button>
    </div>
  );
}
