"use client";
import { useActionState, useRef } from "react";
import { Alert } from "@/components/ui/Alert";
import { Field, Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { changePasswordAction, type ImpostazioniState } from "./actions";

export function PasswordForm({ hasPassword, email }: { hasPassword: boolean; email: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<ImpostazioniState, FormData>(async (prev, fd) => {
    const r = await changePasswordAction(prev, fd);
    if (r.ok) formRef.current?.reset();
    return r;
  }, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} action={action} className="space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && state.message && (
        <Alert kind="success" key={state.nonce}>
          {state.message}
        </Alert>
      )}
      {!hasPassword && (
        <Alert kind="info">Non hai ancora una password: finora hai usato l&apos;accesso con Google. Impostane una per poter accedere anche senza Google.</Alert>
      )}
      <input type="hidden" name="username" value={email} autoComplete="username" readOnly />
      {hasPassword && (
        <Field label="Password attuale *" htmlFor="pw-attuale" error={errors.attuale}>
          <Input id="pw-attuale" name="attuale" type="password" autoComplete="current-password" required />
        </Field>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nuova password *" htmlFor="pw-nuova" error={errors.nuova} hint="Almeno 8 caratteri, con lettere e numeri.">
          <Input id="pw-nuova" name="nuova" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field label="Conferma nuova password *" htmlFor="pw-conferma" error={errors.conferma}>
          <Input id="pw-conferma" name="conferma" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingText="Aggiornamento…">{hasPassword ? "Cambia password" : "Imposta password"}</SubmitButton>
      </div>
    </form>
  );
}
