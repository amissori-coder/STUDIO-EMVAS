"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Link2, Link2Off, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Field, Input, Select } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { linkEmailAction, unlinkEmailAction, type ActionResult } from "./actions";

export interface TaskOption {
  id: string;
  titolo: string;
  scadenzaLabel: string;
}

export function AssociationForm({
  emailId,
  currentClientId,
  currentTaskId,
  currentTask = null,
  clienti,
  suggested,
}: {
  emailId: string;
  currentClientId: string | null;
  currentTaskId: string | null;
  /** attività attualmente collegata (anche se chiusa): resta selezionabile per non perdere il collegamento al salvataggio */
  currentTask?: TaskOption | null;
  clienti: { id: string; denominazione: string }[];
  suggested: { id: string; denominazione: string } | null;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(linkEmailAction, {});
  const [filter, setFilter] = useState("");
  const [clientId, setClientId] = useState(currentClientId ?? "");
  const [taskId, setTaskId] = useState(currentTaskId ?? "");
  const [tasksFor, setTasksFor] = useState<{ clientId: string; tasks: TaskOption[] } | null>(null);
  const [unlinkState, setUnlinkState] = useState<ActionResult>({});
  const [unlinking, startUnlink] = useTransition();

  useEffect(() => {
    if (!clientId) return;
    const controller = new AbortController();
    (async () => {
      let list: TaskOption[] = [];
      try {
        const res = await fetch(`/api/email/tasks?cliente=${encodeURIComponent(clientId)}`, { signal: controller.signal });
        const data = (await res.json()) as { tasks?: TaskOption[] };
        list = data.tasks ?? [];
      } catch {
        list = [];
      }
      if (!controller.signal.aborted) setTasksFor({ clientId, tasks: list });
    })();
    return () => controller.abort();
  }, [clientId]);

  const loadingTasks = !!clientId && tasksFor?.clientId !== clientId;
  const openTasks = tasksFor?.clientId === clientId ? tasksFor.tasks : [];
  // L'API restituisce solo le attività aperte: se quella collegata è ormai chiusa la aggiungo comunque,
  // altrimenti il select controllato ricadrebbe su "Nessuna attività" e il salvataggio la scollegherebbe.
  const keepCurrent = !!taskId && clientId === currentClientId && taskId === currentTaskId && !openTasks.some((t) => t.id === taskId);
  const tasks = keepCurrent ? [{ id: taskId, titolo: currentTask?.titolo ?? "Attività collegata", scadenzaLabel: currentTask?.scadenzaLabel ?? "chiusa" }, ...openTasks] : openTasks;

  const f = filter.trim().toLowerCase();
  const visibili = f ? clienti.filter((c) => c.denominazione.toLowerCase().includes(f)) : clienti;
  const selectedInList = visibili.some((c) => c.id === clientId);
  const showTaskSelect = !!clientId && (loadingTasks || tasks.length > 0 || !!taskId);

  return (
    <div className="space-y-3">
      {suggested && suggested.id !== currentClientId && (
        <form action={action} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          <input type="hidden" name="emailId" value={emailId} />
          <input type="hidden" name="clientId" value={suggested.id} />
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 shrink-0" />
            Indirizzo riconosciuto: <strong>{suggested.denominazione}</strong>
          </span>
          <SubmitButton size="sm" pendingText="Associo…">
            Associa a {suggested.denominazione}
          </SubmitButton>
        </form>
      )}

      <form action={action} className="space-y-3">
        <input type="hidden" name="emailId" value={emailId} />
        <Field label="Cliente" htmlFor="assoc-cliente" hint={f ? `${visibili.length} clienti trovati` : undefined}>
          <div className="space-y-2">
            <Input
              id="assoc-filtro"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtra per denominazione…"
              aria-label="Filtra clienti"
              autoComplete="off"
            />
            <Select id="assoc-cliente" name="clientId" value={clientId} onChange={(e) => { setClientId(e.target.value); setTaskId(""); }} required>
              <option value="">— Seleziona un cliente —</option>
              {!selectedInList && clientId && (
                <option value={clientId}>{clienti.find((c) => c.id === clientId)?.denominazione ?? "Cliente selezionato"}</option>
              )}
              {visibili.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.denominazione}
                </option>
              ))}
            </Select>
          </div>
        </Field>
        {showTaskSelect && (
          <Field label="Attività (facoltativa)" htmlFor="assoc-task" hint="Solo le attività aperte del cliente selezionato">
            <div className="relative">
              <Select id="assoc-task" name="taskId" value={taskId} onChange={(e) => setTaskId(e.target.value)} disabled={loadingTasks}>
                <option value="">— Nessuna attività —</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.titolo} · {t.scadenzaLabel}
                  </option>
                ))}
              </Select>
              {loadingTasks && <Spinner className="absolute right-8 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />}
            </div>
          </Field>
        )}
        {clientId && !loadingTasks && tasks.length === 0 && !taskId && (
          <p className="text-xs text-slate-500">Nessuna attività aperta per questo cliente.</p>
        )}
        {state.error && <Alert kind="error">{state.error}</Alert>}
        {state.ok && state.message && <Alert kind="success">{state.message}</Alert>}
        {unlinkState.error && <Alert kind="error">{unlinkState.error}</Alert>}
        {unlinkState.ok && unlinkState.message && <Alert kind="success">{unlinkState.message}</Alert>}
        <div className="flex flex-wrap gap-2">
          <SubmitButton pendingText="Salvataggio…" disabled={!clientId || loadingTasks}>
            <Link2 className="h-4 w-4" /> Salva associazione
          </SubmitButton>
          {currentClientId && (
            <Button
              type="button"
              variant="outline"
              disabled={unlinking}
              onClick={() => {
                if (!window.confirm("Rimuovere l'associazione di questa email al cliente?")) return;
                startUnlink(async () => {
                  const r = await unlinkEmailAction(emailId);
                  setUnlinkState(r);
                  if (r.ok) {
                    setClientId("");
                    setTaskId("");
                  }
                });
              }}
            >
              {unlinking ? <Spinner className="h-4 w-4" /> : <Link2Off className="h-4 w-4" />}
              Rimuovi associazione
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
