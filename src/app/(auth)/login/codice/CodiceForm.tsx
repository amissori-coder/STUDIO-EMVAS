"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Field, Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { annullaCodiceAction, verificaCodiceAction, type CodiceState } from "./actions";

export function CodiceForm({ nome }: { nome: string }) {
  const [state, action] = useActionState<CodiceState, FormData>(verificaCodiceAction, {});
  const [recupero, setRecupero] = useState(false);

  if (state.ricomincia) {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Alert kind="error" className="mb-4">
          {state.error}
        </Alert>
        <Link href="/login" className="text-sm font-medium text-blue-700 hover:underline">
          Torna all&apos;accesso
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Verifica in due passaggi</h2>
      <p className="mt-1 text-sm text-slate-600">
        {nome}, la password è corretta.{" "}
        {recupero
          ? "Inserisci uno dei codici di recupero che hai salvato quando hai attivato la verifica: ognuno vale una volta sola."
          : "Apri l'app di autenticazione sul telefono e inserisci il codice di 6 cifre dell'account «Studio EMVAS»."}
      </p>
      {state.error && (
        <Alert kind="error" className="mt-4">
          {state.error}
        </Alert>
      )}
      <form action={action} className="mt-4 space-y-4">
        <Field label={recupero ? "Codice di recupero" : "Codice a 6 cifre"} htmlFor="codice">
          <Input
            key={recupero ? "recupero" : "app"}
            id="codice"
            name="codice"
            required
            autoFocus
            autoComplete={recupero ? "off" : "one-time-code"}
            inputMode={recupero ? "text" : "numeric"}
            pattern={recupero ? undefined : "[0-9 ]{6,7}"}
            maxLength={recupero ? 12 : 7}
            placeholder={recupero ? "abcde-fghij" : "123456"}
            className="text-center text-lg tracking-widest"
          />
        </Field>
        <SubmitButton className="w-full" size="lg" pendingText="Verifica in corso…">
          Accedi
        </SubmitButton>
      </form>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" onClick={() => setRecupero((r) => !r)} className="font-medium text-blue-700 hover:underline">
          {recupero ? "Usa il codice dell'app" : "Non hai il telefono? Usa un codice di recupero"}
        </button>
        <form action={annullaCodiceAction}>
          <button type="submit" className="text-slate-500 hover:underline">
            Annulla
          </button>
        </form>
      </div>
      {recupero && (
        <p className="mt-4 text-xs text-slate-500">
          Senza telefono né codici di recupero chiedi a un amministratore dello studio di azzerare la verifica in due passaggi del tuo account.
        </p>
      )}
    </div>
  );
}
