"use client";
import { useState, useTransition } from "react";
import { Check, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { approveAbsenceAction, deleteAbsenceAction, rejectAbsenceAction, type TeamActionState } from "./actions";

/** Azioni su una singola assenza: approva/rifiuta (admin), elimina (admin) o annulla la propria richiesta. */
export function AbsenceActions({
  absenceId,
  stato,
  isAdmin,
  isOwner,
  nome,
}: {
  absenceId: string;
  stato: string;
  isAdmin: boolean;
  isOwner: boolean;
  nome: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<TeamActionState>) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
    });
  };

  const canDelete = isAdmin || (isOwner && stato === "RICHIESTA");
  if (!isAdmin && !canDelete) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isAdmin && stato === "RICHIESTA" && (
        <>
          <Button size="sm" disabled={pending} onClick={() => run(() => approveAbsenceAction(absenceId))} className="h-10 sm:h-8">
            <Check className="h-4 w-4" /> Approva
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => rejectAbsenceAction(absenceId))} className="h-10 sm:h-8">
            <X className="h-4 w-4" /> Rifiuta
          </Button>
        </>
      )}
      {isAdmin && stato === "RIFIUTATA" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => approveAbsenceAction(absenceId))} className="h-10 sm:h-8">
          <Check className="h-4 w-4" /> Approva comunque
        </Button>
      )}
      {isAdmin && stato === "APPROVATA" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => rejectAbsenceAction(absenceId))} className="h-10 sm:h-8">
          <X className="h-4 w-4" /> Revoca
        </Button>
      )}
      {canDelete && (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          className="h-10 text-red-600 hover:bg-red-50 sm:h-8"
          onClick={() => {
            const msg = isOwner && stato === "RICHIESTA" ? "Annullare la tua richiesta di assenza?" : `Eliminare definitivamente l'assenza di ${nome}?`;
            if (window.confirm(msg)) run(() => deleteAbsenceAction(absenceId));
          }}
        >
          <Trash2 className="h-4 w-4" /> {isOwner && stato === "RICHIESTA" ? "Annulla richiesta" : "Elimina"}
        </Button>
      )}
      {error && <p className="basis-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
