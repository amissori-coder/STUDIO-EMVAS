"use client";
import { useActionState } from "react";
import { Ban, Check, Circle, Play, RotateCcw } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { cambiaStato, riassegnaTask, salvaNote, type ActionResult } from "@/modules/attivita/actions";

/** Bottoni di cambio stato (usati sia nella scheda sia nella barra fissa mobile). */
export function StatoButtons({ id, stato, compact = false, className }: { id: string; stato: string; compact?: boolean; className?: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(cambiaStato, {});
  const aperta = stato === "DA_FARE" || stato === "IN_CORSO";

  return (
    <div className={cn("space-y-2", className)}>
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={id} />
        {aperta && stato !== "IN_CORSO" && (
          <Button type="submit" name="stato" value="IN_CORSO" variant="secondary" disabled={pending}>
            <Play className="h-4 w-4" /> In corso
          </Button>
        )}
        {aperta && (
          <Button type="submit" name="stato" value="COMPLETATA" variant="primary" disabled={pending} className="bg-green-600 hover:bg-green-700 focus-visible:ring-green-500">
            <Check className="h-4 w-4" /> Completa
          </Button>
        )}
        {/* In modalità compatta (barra fissa mobile) "Da fare" e "Annulla" restano disponibili come bottoni icona */}
        {aperta && stato !== "DA_FARE" && (
          <Button type="submit" name="stato" value="DA_FARE" variant="outline" size={compact ? "icon" : "md"} disabled={pending} title="Riporta a Da fare" aria-label={compact ? "Riporta a Da fare" : undefined}>
            <Circle className="h-4 w-4" /> {!compact && "Da fare"}
          </Button>
        )}
        {aperta && (
          <Button type="submit" name="stato" value="ANNULLATA" variant="ghost" size={compact ? "icon" : "md"} disabled={pending} className="text-red-600 hover:bg-red-50" title="Annulla attività" aria-label={compact ? "Annulla attività" : undefined}>
            <Ban className="h-4 w-4" /> {!compact && "Annulla attività"}
          </Button>
        )}
        {!aperta && (
          <Button type="submit" name="stato" value="DA_FARE" variant="secondary" disabled={pending}>
            <RotateCcw className="h-4 w-4" /> Riapri
          </Button>
        )}
        {pending && <Spinner className="h-4 w-4 text-slate-400" />}
      </form>
      {state.error && <Alert kind="error">{state.error}</Alert>}
    </div>
  );
}

export function RiassegnaForm({ id, assigneeId, utenti }: { id: string; assigneeId: string | null; utenti: { id: string; nome: string }[] }) {
  const [state, action] = useActionState<ActionResult, FormData>(riassegnaTask, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select name="assigneeId" defaultValue={assigneeId ?? ""} aria-label="Assegnatario" className="sm:flex-1">
          <option value="">— Non assegnata —</option>
          {utenti.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </Select>
        <SubmitButton variant="outline" pendingText="Salvataggio…">
          Riassegna
        </SubmitButton>
      </div>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && !state.error && <p className="text-xs text-green-700">Assegnazione aggiornata.</p>}
    </form>
  );
}

export function NoteForm({ id, note }: { id: string; note: string | null }) {
  const [state, action] = useActionState<ActionResult, FormData>(salvaNote, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Textarea name="note" defaultValue={note ?? ""} placeholder="Appunti interni sull'attività (visibili solo allo staff)…" rows={5} aria-label="Note interne" />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">{state.ok ? "Note salvate." : state.error ? <span className="text-red-600">{state.error}</span> : ""}</p>
        <SubmitButton variant="outline" size="sm" pendingText="Salvataggio…">
          Salva note
        </SubmitButton>
      </div>
    </form>
  );
}
