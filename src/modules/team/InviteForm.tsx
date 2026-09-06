"use client";
import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Field, Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { acceptInviteAction, type InviteState } from "./actions";

export function InviteForm({ token, email }: { token: string; email: string }) {
  const [state, action] = useActionState<InviteState, FormData>(acceptInviteAction.bind(null, token), {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <input type="hidden" name="username" value={email} autoComplete="username" readOnly />
      <Field label="Nuova password" htmlFor="password" hint="Almeno 8 caratteri, con lettere e numeri.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} autoFocus />
      </Field>
      <Field label="Conferma password" htmlFor="conferma">
        <Input id="conferma" name="conferma" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Attivazione in corso…">
        Imposta password e accedi
      </SubmitButton>
    </form>
  );
}
