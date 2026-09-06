"use client";
import { useActionState } from "react";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { syncNowAction, type ActionResult } from "./actions";

export interface AccountChip {
  id: string;
  googleEmail: string;
  userName: string;
  /** già formattato lato server (es. "oggi alle 10:12") */
  lastSyncLabel: string | null;
  syncError: string | null;
}

/** Barra di stato delle caselle Gmail collegate + bottone "Sincronizza ora" con esito. */
export function EmailAccountsBar({ accounts, canSync }: { accounts: AccountChip[]; canSync: boolean }) {
  const [state, action, pending] = useActionState<ActionResult>(async () => syncNowAction(), {});
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <ul className="flex flex-wrap gap-2">
          {accounts.map((a) => (
            <li
              key={a.id}
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                a.syncError ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-white text-slate-600",
              )}
              title={a.syncError ?? `${a.userName} · ultima sincronizzazione: ${a.lastSyncLabel ?? "mai"}`}
            >
              {a.syncError ? <AlertCircle className="h-3.5 w-3.5 shrink-0" /> : <Inbox className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
              <span className="truncate font-medium">{a.googleEmail}</span>
              <span className={cn("hidden shrink-0 sm:inline", a.syncError ? "text-red-600" : "text-slate-400")}>
                {a.syncError ? "· errore" : a.lastSyncLabel ? `· ${a.lastSyncLabel}` : "· mai sincronizzata"}
              </span>
            </li>
          ))}
        </ul>
        {canSync && (
          <form action={action} className="shrink-0">
            <Button type="submit" variant="outline" disabled={pending} className="w-full sm:w-auto">
              {pending ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
              {pending ? "Sincronizzazione…" : "Sincronizza ora"}
            </Button>
          </form>
        )}
      </div>
      {accounts.some((a) => a.syncError) && (
        <ul className="space-y-1">
          {accounts
            .filter((a) => a.syncError)
            .map((a) => (
              <li key={a.id} className="text-xs text-red-600">
                <span className="font-medium">{a.googleEmail}:</span> {a.syncError}
              </li>
            ))}
        </ul>
      )}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && state.message && <Alert kind="success">{state.message}</Alert>}
    </div>
  );
}
