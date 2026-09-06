"use client";
import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import { Input, Field } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";

const ERRORI: Record<string, string> = {
  "google-non-configurato": "L'accesso con Google non è configurato.",
  "google-stato": "Sessione di accesso Google non valida: riprova.",
  "google-utente": "Nessun utente dello studio corrisponde a questo account Google.",
  "google-dominio": "Account Google non appartenente al dominio dello studio.",
  "google-errore": "Errore durante l'accesso con Google.",
  "google-negato": "Accesso con Google annullato.",
};

export function LoginForm({ next, googleEnabled, errore, messaggio }: { next: string; googleEnabled: boolean; errore?: string; messaggio?: string }) {
  const [state, action] = useActionState<LoginState, FormData>(loginAction, {});
  const erroreUrl = errore ? ERRORI[errore] ?? "Si è verificato un errore." : null;

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {messaggio && <Alert kind="success" className="mb-4">{messaggio}</Alert>}
      {(state.error || erroreUrl) && <Alert kind="error" className="mb-4">{state.error ?? erroreUrl}</Alert>}
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="username" required placeholder="nome@studio.it" />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton className="w-full" size="lg" pendingText="Accesso in corso…">
          Accedi
        </SubmitButton>
      </form>
      {googleEnabled && (
        <>
          <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            oppure
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <a
            href={`/api/auth/google?mode=login${next ? `&next=${encodeURIComponent(next)}` : ""}`}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
            </svg>
            Accedi con Google (staff)
          </a>
        </>
      )}
    </div>
  );
}
