"use client";
import { useActionState, useState } from "react";
import { Copy, KeyRound, Link2, Plus, ShieldCheck, ShieldOff, Unlink, UserRoundPlus } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  createPortalUserAction,
  linkPortalUserAction,
  resetPortalPasswordAction,
  setPortalUserActiveAction,
  unlinkPortalUserAction,
  type SimpleState,
} from "./actions";

export interface PortalUserRow {
  id: string;
  nome: string;
  email: string;
  attivo: boolean;
  colore: string;
  ultimoAccesso: string | null;
}

interface Credenziali {
  email: string;
  password: string;
  nuovo: boolean;
}

function CredentialsBox({ cred, onDismiss }: { cred: Credenziali; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  const testo = `Accesso portale Studio EMVAS\nEmail: ${cred.email}\nPassword: ${cred.password}`;
  return (
    <Alert kind="success" title={cred.nuovo ? "Utente creato: credenziali di accesso" : "Nuova password impostata"}>
      <p className="mt-1">Comunica queste credenziali al cliente. La password viene mostrata solo adesso e non sarà più recuperabile.</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-white/70 px-3 py-2 font-mono text-sm text-slate-900">
        <dt className="font-sans text-slate-500">Email</dt>
        <dd className="break-all">{cred.email}</dd>
        <dt className="font-sans text-slate-500">Password</dt>
        <dd className="break-all select-all">{cred.password}</dd>
      </dl>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(testo);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          <Copy className="h-4 w-4" /> {copied ? "Copiato" : "Copia credenziali"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Ho preso nota
        </Button>
      </div>
    </Alert>
  );
}

function NewUserForm({ clientId, onCreated, onCancel }: { clientId: string; onCreated: (c: Credenziali) => void; onCancel: () => void }) {
  const [state, formAction] = useActionState<SimpleState, FormData>(async (prev, fd) => {
    const r = await createPortalUserAction(clientId, prev, fd);
    if (r.ok && r.password) onCreated({ email: String(fd.get("email") ?? "").trim().toLowerCase(), password: r.password, nuovo: true });
    return r;
  }, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field label="Nome e cognome *" htmlFor="u-nome" error={errors.nome}>
        <Input id="u-nome" name="nome" required maxLength={120} autoFocus autoComplete="off" />
      </Field>
      <Field label="Email *" htmlFor="u-email" error={errors.email} hint="Sarà il nome utente per accedere al portale.">
        <Input id="u-email" name="email" type="email" required maxLength={200} autoComplete="off" />
      </Field>
      <Field label="Password" htmlFor="u-password" error={errors.password} hint="Lascia vuoto per generarne una automaticamente (min. 8 caratteri, lettere e numeri).">
        <Input id="u-password" name="password" type="text" maxLength={100} autoComplete="new-password" placeholder="Generata automaticamente" />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <SubmitButton pendingText="Creazione…">Crea utente</SubmitButton>
      </div>
    </form>
  );
}

function LinkUserForm({ clientId, onDone, onCancel }: { clientId: string; onDone: () => void; onCancel: () => void }) {
  const [state, formAction] = useActionState<SimpleState, FormData>(async (prev, fd) => {
    const r = await linkPortalUserAction(clientId, prev, fd);
    if (r.ok) onDone();
    return r;
  }, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field label="Email dell'utente *" htmlFor="l-email" error={state.fieldErrors?.email} hint="L'utente deve già esistere nel portale (es. un cliente con più aziende).">
        <Input id="l-email" name="email" type="email" required maxLength={200} autoFocus autoComplete="off" />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <SubmitButton pendingText="Collegamento…">Collega</SubmitButton>
      </div>
    </form>
  );
}

function ResetPasswordForm({
  clientId,
  utente,
  onDone,
  onCancel,
}: {
  clientId: string;
  utente: PortalUserRow;
  onDone: (c: Credenziali) => void;
  onCancel: () => void;
}) {
  const [state, formAction] = useActionState<SimpleState, FormData>(async (prev, fd) => {
    const r = await resetPortalPasswordAction(clientId, utente.id, prev, fd);
    if (r.ok && r.password) onDone({ email: utente.email, password: r.password, nuovo: false });
    return r;
  }, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <p className="text-sm text-slate-600">
        Verrà impostata una nuova password per <span className="font-medium text-slate-900">{utente.nome}</span> ({utente.email}).
      </p>
      <Field label="Nuova password" htmlFor="r-password" error={state.fieldErrors?.password} hint="Lascia vuoto per generarne una automaticamente.">
        <Input id="r-password" name="password" type="text" maxLength={100} autoComplete="new-password" placeholder="Generata automaticamente" autoFocus />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <SubmitButton pendingText="Salvataggio…">Reimposta password</SubmitButton>
      </div>
    </form>
  );
}

type ModalState = { kind: "none" } | { kind: "new" } | { kind: "link" } | { kind: "reset"; utente: PortalUserRow };

/** `canManage`: admin o referente del cliente; gli altri collaboratori vedono solo l'elenco. */
export function PortalAccessCard({ clientId, utenti, canManage }: { clientId: string; utenti: PortalUserRow[]; canManage: boolean }) {
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [cred, setCred] = useState<Credenziali | null>(null);
  const [error, setError] = useState<string | null>(null);
  const close = () => setModal({ kind: "none" });

  const run = async (fn: () => Promise<SimpleState>) => {
    setError(null);
    const r = await fn();
    if (r.error) setError(r.error);
  };

  const title = modal.kind === "new" ? "Nuovo utente del portale" : modal.kind === "link" ? "Collega utente esistente" : modal.kind === "reset" ? "Reimposta password" : "";

  return (
    <Card>
      <CardHeader
        title="Accesso al portale clienti"
        description="Utenti che possono accedere all'area riservata per caricare e consultare documenti."
        actions={
          canManage ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setModal({ kind: "link" })}>
                <Link2 className="h-4 w-4" /> Collega esistente
              </Button>
              <Button size="sm" onClick={() => setModal({ kind: "new" })}>
                <Plus className="h-4 w-4" /> Nuovo utente
              </Button>
            </>
          ) : undefined
        }
      />
      <CardBody className="space-y-3">
        {cred && <CredentialsBox cred={cred} onDismiss={() => setCred(null)} />}
        {error && <Alert kind="error">{error}</Alert>}
        {!canManage && <p className="text-xs text-slate-500">Gli accessi al portale possono essere gestiti solo da un amministratore o dal referente del cliente.</p>}
        {utenti.length === 0 ? (
          <EmptyState
            icon={<UserRoundPlus />}
            title="Nessun accesso al portale"
            description="Crea un utente per permettere al cliente di caricare i documenti nell'area riservata."
            className="py-6"
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {utenti.map((u) => (
              <li key={u.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar nome={u.nome} colore={u.colore} size="sm" />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                      <span className="truncate">{u.nome}</span>
                      {u.attivo ? <Badge color="green">Attivo</Badge> : <Badge color="red">Disattivato</Badge>}
                    </p>
                    <p className="truncate text-sm text-slate-600">{u.email}</p>
                    <p className="text-xs text-slate-400">{u.ultimoAccesso ? `Ultimo accesso: ${u.ultimoAccesso}` : "Non ha ancora effettuato l'accesso"}</p>
                  </div>
                </div>
                {canManage && (
                  <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                    <Button size="sm" variant="outline" onClick={() => setModal({ kind: "reset", utente: u })}>
                      <KeyRound className="h-4 w-4" /> Password
                    </Button>
                    <form action={() => run(() => setPortalUserActiveAction(clientId, u.id, !u.attivo))}>
                      <Button type="submit" size="sm" variant="outline" title={u.attivo ? "Disattiva l'accesso" : "Riattiva l'accesso"}>
                        {u.attivo ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                        {u.attivo ? "Disattiva" : "Attiva"}
                      </Button>
                    </form>
                    <form action={() => run(() => unlinkPortalUserAction(clientId, u.id))}>
                      <ConfirmButton
                        message={`Scollegare ${u.nome} da questo cliente? L'utente non potrà più vedere i documenti di questo cliente.`}
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Unlink className="h-4 w-4" /> Scollega
                      </ConfirmButton>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      <Modal open={modal.kind !== "none"} onClose={close} title={title}>
        {modal.kind === "new" && (
          <NewUserForm
            clientId={clientId}
            onCancel={close}
            onCreated={(c) => {
              setCred(c);
              close();
            }}
          />
        )}
        {modal.kind === "link" && <LinkUserForm clientId={clientId} onDone={close} onCancel={close} />}
        {modal.kind === "reset" && (
          <ResetPasswordForm
            clientId={clientId}
            utente={modal.utente}
            onCancel={close}
            onDone={(c) => {
              setCred(c);
              close();
            }}
          />
        )}
      </Modal>
    </Card>
  );
}
