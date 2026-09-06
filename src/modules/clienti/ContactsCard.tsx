"use client";
import { useActionState, useState } from "react";
import { Mail, Pencil, Phone, Plus, Trash2, UserRound } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { deleteContactAction, saveContactAction, type SimpleState } from "./actions";

export interface ContactRow {
  id: string;
  nome: string;
  email: string | null;
  telefono: string | null;
  ruolo: string | null;
}

function ContactForm({ clientId, contact, onDone }: { clientId: string; contact: ContactRow | null; onDone: () => void }) {
  const [state, formAction] = useActionState<SimpleState, FormData>(async (prev, fd) => {
    const r = await saveContactAction(clientId, contact?.id ?? null, prev, fd);
    if (r.ok) onDone();
    return r;
  }, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field label="Nome e cognome *" htmlFor="c-nome" error={errors.nome}>
        <Input id="c-nome" name="nome" defaultValue={contact?.nome ?? ""} required maxLength={120} autoFocus />
      </Field>
      <Field label="Ruolo" htmlFor="c-ruolo" error={errors.ruolo} hint="Es. Amministratore, Responsabile amministrazione">
        <Input id="c-ruolo" name="ruolo" defaultValue={contact?.ruolo ?? ""} maxLength={80} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="c-email" error={errors.email}>
          <Input id="c-email" name="email" type="email" defaultValue={contact?.email ?? ""} maxLength={200} />
        </Field>
        <Field label="Telefono" htmlFor="c-telefono" error={errors.telefono}>
          <Input id="c-telefono" name="telefono" type="tel" defaultValue={contact?.telefono ?? ""} maxLength={50} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onDone}>
          Annulla
        </Button>
        <SubmitButton pendingText="Salvataggio…">{contact ? "Salva" : "Aggiungi contatto"}</SubmitButton>
      </div>
    </form>
  );
}

export function ContactsCard({ clientId, contatti }: { clientId: string; contatti: ContactRow[] }) {
  const [editing, setEditing] = useState<ContactRow | null | "new">(null);
  const [error, setError] = useState<string | null>(null);
  const open = editing !== null;
  const close = () => setEditing(null);

  return (
    <Card>
      <CardHeader
        title="Contatti"
        description="Persone di riferimento presso il cliente."
        actions={
          <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Aggiungi
          </Button>
        }
      />
      <CardBody className="space-y-3">
        {error && <Alert kind="error">{error}</Alert>}
        {contatti.length === 0 ? (
          <EmptyState
            icon={<UserRound />}
            title="Nessun contatto"
            description="Aggiungi le persone di riferimento del cliente (amministratore, responsabile amministrazione, ecc.)."
            className="py-6"
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {contatti.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    <span className="break-words">{c.nome}</span>
                    {c.ruolo && <span className="block text-xs font-normal text-slate-500 sm:ml-2 sm:inline">{c.ruolo}</span>}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="inline-flex min-h-6 items-center gap-1 hover:text-blue-700">
                        <Mail className="h-3.5 w-3.5" /> <span className="break-all">{c.email}</span>
                      </a>
                    )}
                    {c.telefono && (
                      <a href={`tel:${c.telefono.replace(/\s+/g, "")}`} className="inline-flex min-h-6 items-center gap-1 hover:text-blue-700">
                        <Phone className="h-3.5 w-3.5" /> {c.telefono}
                      </a>
                    )}
                    {!c.email && !c.telefono && <span className="text-slate-400">Nessun recapito</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(c)} aria-label={`Modifica ${c.nome}`} title="Modifica">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <form
                    action={async () => {
                      setError(null);
                      const r = await deleteContactAction(clientId, c.id);
                      if (r.error) setError(r.error);
                    }}
                  >
                    <ConfirmButton
                      message={`Eliminare il contatto "${c.nome}"?`}
                      size="icon"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      aria-label={`Elimina ${c.nome}`}
                      title="Elimina"
                    >
                      <Trash2 className="h-4 w-4" />
                    </ConfirmButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      <Modal open={open} onClose={close} title={editing === "new" || editing === null ? "Nuovo contatto" : "Modifica contatto"}>
        {open && <ContactForm key={editing === "new" ? "new" : editing.id} clientId={clientId} contact={editing === "new" ? null : editing} onDone={close} />}
      </Modal>
    </Card>
  );
}
