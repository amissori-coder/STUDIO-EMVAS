import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeColor = "slate" | "blue" | "green" | "yellow" | "red" | "purple" | "orange" | "teal";

const colors: Record<BadgeColor, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  green: "bg-green-50 text-green-700 ring-green-200",
  yellow: "bg-yellow-50 text-yellow-800 ring-yellow-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  purple: "bg-purple-50 text-purple-700 ring-purple-200",
  orange: "bg-orange-50 text-orange-700 ring-orange-200",
  teal: "bg-teal-50 text-teal-700 ring-teal-200",
};

export function Badge({ children, color = "slate", className }: { children: ReactNode; color?: BadgeColor; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", colors[color], className)}>
      {children}
    </span>
  );
}

/** Colori standard per stati/priorità (usati in tutta l'app per coerenza). */
export const STATO_TASK_COLOR: Record<string, BadgeColor> = {
  DA_FARE: "slate",
  IN_CORSO: "blue",
  COMPLETATA: "green",
  ANNULLATA: "red",
};
export const PRIORITA_COLOR: Record<string, BadgeColor> = { BASSA: "slate", MEDIA: "yellow", ALTA: "red" };
export const STATO_ASSENZA_COLOR: Record<string, BadgeColor> = { RICHIESTA: "yellow", APPROVATA: "green", RIFIUTATA: "red" };
export const TIPO_ASSENZA_COLOR: Record<string, BadgeColor> = { FERIE: "blue", MALATTIA: "red", PERMESSO: "purple", ALTRO: "slate" };
export const REGIME_COLOR: Record<string, BadgeColor> = { ORDINARIO: "blue", SEMPLIFICATO: "teal", FORFETTARIO: "green", NON_TITOLARE: "slate" };
