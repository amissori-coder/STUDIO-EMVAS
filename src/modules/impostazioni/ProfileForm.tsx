"use client";
import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Field, Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ColorPicker } from "@/modules/team/ColorPicker";
import { updateProfileAction, type ImpostazioniState } from "./actions";

export function ProfileForm({ nome, email, telefono, colore }: { nome: string; email: string; telefono: string | null; colore: string }) {
  const [col, setCol] = useState(colore);
  const [nomeCorrente, setNomeCorrente] = useState(nome);
  const [state, action] = useActionState<ImpostazioniState, FormData>(updateProfileAction, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && state.message && (
        <Alert kind="success" key={state.nonce}>
          {state.message}
        </Alert>
      )}
      <div className="flex items-center gap-3">
        <Avatar nome={nomeCorrente || nome} colore={col} size="lg" />
        <div className="min-w-0 text-sm">
          <p className="font-medium text-slate-900">{email}</p>
          <p className="text-slate-500">L&apos;email di accesso non può essere modificata da qui.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nome e cognome *" htmlFor="pr-nome" error={errors.nome}>
          <Input id="pr-nome" name="nome" required maxLength={120} defaultValue={nome} onChange={(e) => setNomeCorrente(e.target.value)} autoComplete="name" />
        </Field>
        <Field label="Telefono" htmlFor="pr-telefono" error={errors.telefono} hint="Visibile ai colleghi nella pagina Team.">
          <Input id="pr-telefono" name="telefono" type="tel" maxLength={40} defaultValue={telefono ?? ""} autoComplete="tel" />
        </Field>
      </div>
      <Field label="Colore" error={errors.colore} hint="Usato per il tuo avatar e nel calendario delle assenze.">
        <ColorPicker name="colore" value={col} onChange={setCol} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingText="Salvataggio…">Salva profilo</SubmitButton>
      </div>
    </form>
  );
}
