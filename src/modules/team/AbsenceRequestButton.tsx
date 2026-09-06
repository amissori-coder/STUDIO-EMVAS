"use client";
import { useActionState, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TIPI_ASSENZA } from "@/lib/constants";
import { requestAbsenceAction, type TeamActionState } from "./actions";

export function AbsenceRequestButton({
  isAdmin,
  currentUserId,
  utenti,
}: {
  isAdmin: boolean;
  currentUserId: string;
  utenti: { id: string; nome: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [esito, setEsito] = useState<{ ok: boolean; warning?: string; perAltro: boolean } | null>(null);
  const [inizio, setInizio] = useState("");
  const [fine, setFine] = useState("");
  const [state, formAction] = useActionState<TeamActionState, FormData>(async (prev, fd) => {
    const r = await requestAbsenceAction(prev, fd);
    if (r.ok) {
      const userId = String(fd.get("userId") ?? "");
      setEsito({ ok: true, warning: r.warning, perAltro: isAdmin && !!userId && userId !== currentUserId });
      setOpen(false);
    }
    return r;
  }, {});
  const errors = state.fieldErrors ?? {};

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4" /> Richiedi assenza
      </Button>
      {esito && (
        <div className="fixed left-1/2 top-4 z-50 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 shadow-lg" role="status">
          <Alert kind={esito.warning ? "warning" : "success"} title={esito.perAltro ? "Assenza registrata e approvata." : "Richiesta inviata agli amministratori."}>
            {esito.warning && <p>{esito.warning}</p>}
            <Button size="sm" variant="ghost" className="mt-1 -ml-2" onClick={() => setEsito(null)}>
              Chiudi
            </Button>
          </Alert>
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Richiedi assenza">
        <form action={formAction} className="space-y-4">
          {state.error && <Alert kind="error">{state.error}</Alert>}
          {isAdmin && (
            <Field label="Collaboratore" htmlFor="a-userId" error={errors.userId} hint="Se scegli un altro collaboratore l'assenza viene registrata come già approvata.">
              <Select id="a-userId" name="userId" defaultValue={currentUserId}>
                {utenti.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.id === currentUserId ? `${u.nome} (io)` : u.nome}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Tipo" htmlFor="a-tipo" error={errors.tipo}>
            <Select id="a-tipo" name="tipo" defaultValue="FERIE">
              {Object.entries(TIPI_ASSENZA).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Dal *" htmlFor="a-inizio" error={errors.dataInizio}>
              <Input
                id="a-inizio"
                name="dataInizio"
                type="date"
                required
                value={inizio}
                onChange={(e) => {
                  setInizio(e.target.value);
                  if (fine && e.target.value > fine) setFine(e.target.value);
                }}
              />
            </Field>
            <Field label="Al *" htmlFor="a-fine" error={errors.dataFine}>
              <Input id="a-fine" name="dataFine" type="date" required min={inizio || undefined} value={fine} onChange={(e) => setFine(e.target.value)} />
            </Field>
          </div>
          <Field label="Note" htmlFor="a-note" error={errors.note}>
            <Textarea id="a-note" name="note" maxLength={500} placeholder="Facoltative: motivo, reperibilità, chi sostituisce…" className="min-h-[72px]" />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <SubmitButton pendingText="Invio…">Invia richiesta</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
