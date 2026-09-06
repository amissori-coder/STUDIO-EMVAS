"use client";
import { COLORI_UTENTE } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Selettore del colore utente (palette COLORI_UTENTE); il valore viene inviato tramite input nascosto. */
export function ColorPicker({ name, value, onChange }: { name: string; value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colore">
      <input type="hidden" name={name} value={value} />
      {COLORI_UTENTE.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-transform",
            value === c ? "scale-110 border-slate-900" : "border-transparent hover:scale-105",
          )}
        >
          <span className="h-7 w-7 rounded-full" style={{ backgroundColor: c }} />
        </button>
      ))}
    </div>
  );
}
