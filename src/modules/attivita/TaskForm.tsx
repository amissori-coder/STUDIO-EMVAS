"use client";
import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Button } from "@/components/ui/Button";
import { CATEGORIE_ADEMPIMENTO, PRIORITA_TASK } from "@/lib/constants";
import type { ActionResult } from "@/modules/attivita/actions";

export interface TaskFormValues {
  id?: string;
  titolo?: string;
  descrizione?: string | null;
  clientId?: string | null;
  scadenza?: string; // yyyy-MM-dd
  priorita?: string;
  assigneeId?: string | null;
  giorniPreavviso?: number;
  templateId?: string | null;
}

export interface OpzioneTemplate {
  id: string;
  nome: string;
  categoria: string;
}

export function TaskForm({
  action,
  valori,
  clienti,
  utenti,
  templates,
  submitLabel,
  onSuccess,
  onCancel,
  cancelHref,
  collegati,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  valori: TaskFormValues;
  clienti: { id: string; denominazione: string }[];
  utenti: { id: string; nome: string; attivo?: boolean }[];
  templates: OpzioneTemplate[];
  submitLabel: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  cancelHref?: string;
  /** email e documenti già collegati all'attività: cambiando cliente vengono scollegati */
  collegati?: { email: number; documenti: number };
}) {
  const [clienteScelto, setClienteScelto] = useState(valori.clientId ?? "");
  const cambioCliente = !!valori.id && clienteScelto !== (valori.clientId ?? "");
  const daScollegare = [
    collegati?.email ? (collegati.email === 1 ? "1 email" : `${collegati.email} email`) : null,
    collegati?.documenti ? (collegati.documenti === 1 ? "1 documento" : `${collegati.documenti} documenti`) : null,
  ].filter(Boolean);
  const totaleCollegati = (collegati?.email ?? 0) + (collegati?.documenti ?? 0);
  const verboScollegati =
    totaleCollegati === 1
      ? collegati?.email
        ? "verrà scollegata"
        : "verrà scollegato"
      : collegati?.documenti
        ? "verranno scollegati"
        : "verranno scollegate";
  const [state, formAction] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await action(prev, fd);
    if (r.ok) onSuccess?.();
    return r;
  }, {});

  const templatePerCategoria = Object.keys(CATEGORIE_ADEMPIMENTO)
    .map((cat) => ({ cat, items: templates.filter((t) => t.categoria === cat) }))
    .filter((g) => g.items.length > 0);

  return (
    <form action={formAction} className="space-y-4">
      {valori.id && <input type="hidden" name="id" value={valori.id} />}
      {state.error && <Alert kind="error">{state.error}</Alert>}

      <Field label="Titolo *" htmlFor="titolo">
        <Input id="titolo" name="titolo" required maxLength={200} defaultValue={valori.titolo ?? ""} placeholder="Es. Invio F24 ritenute dipendenti" autoFocus={!valori.id} />
      </Field>

      <Field label="Descrizione" htmlFor="descrizione">
        <Textarea id="descrizione" name="descrizione" defaultValue={valori.descrizione ?? ""} placeholder="Dettagli, riferimenti, cosa serve…" />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Cliente" htmlFor="clientId" hint="Facoltativo: lascia vuoto per attività interne allo studio.">
          <Select id="clientId" name="clientId" value={clienteScelto} onChange={(e) => setClienteScelto(e.target.value)}>
            <option value="">— Nessun cliente (interna) —</option>
            {clienti.map((c) => (
              <option key={c.id} value={c.id}>
                {c.denominazione}
              </option>
            ))}
          </Select>
        </Field>
        {cambioCliente && daScollegare.length > 0 && (
          <p className="text-sm text-amber-700 sm:col-span-2">
            Cambiando cliente, {daScollegare.join(" e ")} del cliente attuale {verboScollegati} da questa attività:{" "}
            {totaleCollegati === 1 ? "resta" : "restano"} nella scheda del cliente attuale.
          </p>
        )}
        <Field label="Scadenza *" htmlFor="scadenza">
          <Input id="scadenza" name="scadenza" type="date" required defaultValue={valori.scadenza ?? ""} />
        </Field>
        <Field label="Priorità" htmlFor="priorita">
          <Select id="priorita" name="priorita" defaultValue={valori.priorita ?? "MEDIA"}>
            {Object.entries(PRIORITA_TASK).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Assegnatario" htmlFor="assigneeId">
          <Select id="assigneeId" name="assigneeId" defaultValue={valori.assigneeId ?? ""}>
            <option value="">— Non assegnata —</option>
            {utenti.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
                {u.attivo === false ? " (disattivato)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Giorni di preavviso" htmlFor="giorniPreavviso" hint="Quanti giorni prima della scadenza inviare il promemoria.">
          <Input id="giorniPreavviso" name="giorniPreavviso" type="number" min={0} max={365} defaultValue={valori.giorniPreavviso ?? 7} />
        </Field>
        <Field label="Adempimento (categoria)" htmlFor="templateId" hint="Facoltativo: collega l'attività a un adempimento del catalogo.">
          <Select id="templateId" name="templateId" defaultValue={valori.templateId ?? ""}>
            <option value="">— Nessuno —</option>
            {templatePerCategoria.map((g) => (
              <optgroup key={g.cat} label={CATEGORIE_ADEMPIMENTO[g.cat as keyof typeof CATEGORIE_ADEMPIMENTO]}>
                {g.items.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Annulla
          </Button>
        ) : cancelHref ? (
          <Button href={cancelHref} variant="outline">
            Annulla
          </Button>
        ) : null}
        <SubmitButton pendingText="Salvataggio…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
