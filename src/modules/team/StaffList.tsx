"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarOff,
  Copy,
  KeyRound,
  Mail,
  MailCheck,
  Pencil,
  Phone,
  Plus,
  Send,
  ShieldCheck,
  ShieldOff,
  UserRound,
  Users,
} from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { COLORI_UTENTE, RUOLI, TIPI_ASSENZA } from "@/lib/constants";
import { ColorPicker } from "./ColorPicker";
import { cn } from "@/lib/utils";
import type { StaffRow } from "./queries";
import {
  changeRoleAction,
  createCollaboratorAction,
  resendInviteAction,
  setStaffActiveAction,
  setTempPasswordAction,
  updateStaffAction,
  type TeamActionState,
} from "./actions";

// ---------------------------------------------------------------------------
// Componenti di supporto
// ---------------------------------------------------------------------------
function CopyButton({ text, label = "Copia" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
    >
      <Copy className="h-4 w-4" /> {copied ? "Copiato" : label}
    </Button>
  );
}

interface Esito {
  kind: "invito" | "password";
  nome: string;
  email: string;
  link?: string;
  emailSent?: boolean;
  password?: string;
}

function EsitoBox({ esito, onDismiss }: { esito: Esito; onDismiss: () => void }) {
  if (esito.kind === "invito") {
    return (
      <Alert kind="success" title={`Invito pronto per ${esito.nome}`}>
        <p className="mt-1">
          {esito.emailSent
            ? `L'invito è stato inviato via email a ${esito.email}. Puoi comunque copiare il link qui sotto.`
            : `L'invio email non è configurato: copia il link e invialo a ${esito.email}. Il link è valido 7 giorni.`}
        </p>
        <p className="mt-2 break-all rounded-md bg-white/70 px-3 py-2 font-mono text-xs text-slate-900 select-all">{esito.link}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <CopyButton text={esito.link ?? ""} label="Copia link" />
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Chiudi
          </Button>
        </div>
      </Alert>
    );
  }
  return (
    <Alert kind="success" title={`Password temporanea per ${esito.nome}`}>
      <p className="mt-1">Comunica la password al collaboratore: viene mostrata solo adesso. Potrà cambiarla da Impostazioni.</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-white/70 px-3 py-2 font-mono text-sm text-slate-900">
        <dt className="font-sans text-slate-500">Email</dt>
        <dd className="break-all">{esito.email}</dd>
        <dt className="font-sans text-slate-500">Password</dt>
        <dd className="break-all select-all">{esito.password}</dd>
      </dl>
      <div className="mt-2 flex flex-wrap gap-2">
        <CopyButton text={`Accesso Studio EMVAS\nEmail: ${esito.email}\nPassword: ${esito.password}`} label="Copia credenziali" />
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Ho preso nota
        </Button>
      </div>
    </Alert>
  );
}

// ---------------------------------------------------------------------------
// Form nei modali
// ---------------------------------------------------------------------------
function NewStaffForm({ onCreated, onCancel }: { onCreated: (e: Esito) => void; onCancel: () => void }) {
  const [colore, setColore] = useState(COLORI_UTENTE[0]!);
  const [state, formAction] = useActionState<TeamActionState, FormData>(async (prev, fd) => {
    const r = await createCollaboratorAction(prev, fd);
    if (r.ok && r.inviteLink) {
      onCreated({
        kind: "invito",
        nome: String(fd.get("nome") ?? ""),
        email: String(fd.get("email") ?? "").trim().toLowerCase(),
        link: r.inviteLink,
        emailSent: r.emailSent,
      });
    }
    return r;
  }, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field label="Nome e cognome *" htmlFor="n-nome" error={errors.nome}>
        <Input id="n-nome" name="nome" required maxLength={120} autoFocus autoComplete="off" />
      </Field>
      <Field label="Email *" htmlFor="n-email" error={errors.email} hint="Riceverà un link di invito per impostare la password.">
        <Input id="n-email" name="email" type="email" required maxLength={200} autoComplete="off" />
      </Field>
      <Field label="Ruolo" htmlFor="n-ruolo" error={errors.ruolo}>
        <Select id="n-ruolo" name="ruolo" defaultValue="COLLABORATORE">
          <option value="COLLABORATORE">{RUOLI.COLLABORATORE}</option>
          <option value="ADMIN">{RUOLI.ADMIN}</option>
        </Select>
      </Field>
      <Field label="Colore" error={errors.colore} hint="Usato per l'avatar e nel calendario.">
        <ColorPicker name="colore" value={colore} onChange={setColore} />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <SubmitButton pendingText="Creazione…">Crea e genera invito</SubmitButton>
      </div>
    </form>
  );
}

function EditStaffForm({ utente, onDone, onCancel }: { utente: StaffRow; onDone: () => void; onCancel: () => void }) {
  const [colore, setColore] = useState(utente.colore);
  const [state, formAction] = useActionState<TeamActionState, FormData>(async (prev, fd) => {
    const r = await updateStaffAction(utente.id, prev, fd);
    if (r.ok) onDone();
    return r;
  }, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field label="Nome e cognome *" htmlFor="e-nome" error={errors.nome}>
        <Input id="e-nome" name="nome" required maxLength={120} defaultValue={utente.nome} autoFocus />
      </Field>
      <Field label="Telefono" htmlFor="e-telefono" error={errors.telefono}>
        <Input id="e-telefono" name="telefono" type="tel" maxLength={40} defaultValue={utente.telefono ?? ""} />
      </Field>
      <Field label="Colore" error={errors.colore}>
        <ColorPicker name="colore" value={colore} onChange={setColore} />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <SubmitButton pendingText="Salvataggio…">Salva</SubmitButton>
      </div>
    </form>
  );
}

function TempPasswordForm({ utente, onDone, onCancel }: { utente: StaffRow; onDone: (e: Esito) => void; onCancel: () => void }) {
  const [state, formAction] = useActionState<TeamActionState, FormData>(async (prev, fd) => {
    const r = await setTempPasswordAction(utente.id, prev, fd);
    if (r.ok && r.password) onDone({ kind: "password", nome: utente.nome, email: utente.email, password: r.password });
    return r;
  }, {});
  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <p className="text-sm text-slate-600">
        Verrà impostata una password temporanea per <span className="font-medium text-slate-900">{utente.nome}</span> ({utente.email}). Un eventuale invito pendente
        verrà annullato.
      </p>
      <Field label="Password temporanea" htmlFor="p-password" error={state.fieldErrors?.password} hint="Lascia vuoto per generarne una automaticamente (min. 8 caratteri, lettere e numeri).">
        <Input id="p-password" name="password" type="text" maxLength={100} autoComplete="new-password" placeholder="Generata automaticamente" autoFocus />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <SubmitButton pendingText="Salvataggio…">Imposta password</SubmitButton>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Scheda collaboratore
// ---------------------------------------------------------------------------
function StaffCard({
  u,
  isAdmin,
  currentUserId,
  busy,
  onEdit,
  onPassword,
  onResend,
  onRole,
  onActive,
}: {
  u: StaffRow;
  isAdmin: boolean;
  currentUserId: string;
  busy: boolean;
  onEdit: () => void;
  onPassword: () => void;
  onResend: () => void;
  onRole: (r: string) => void;
  onActive: (attivo: boolean) => void;
}) {
  const isSelf = u.id === currentUserId;
  const invitoPendente = !!u.inviteExpires;
  const invitoScaduto = invitoPendente && new Date(u.inviteExpires!) < new Date();
  return (
    <li className={cn("rounded-xl border border-slate-200 bg-white p-4 shadow-sm", !u.attivo && "opacity-70")}>
      <div className="flex items-start gap-3">
        <Avatar nome={u.nome} colore={u.colore} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold text-slate-900">
              {u.nome}
              {isSelf && <span className="ml-1 text-xs font-normal text-slate-400">(tu)</span>}
            </p>
            <Badge color={u.ruolo === "ADMIN" ? "purple" : "blue"}>{RUOLI[u.ruolo as keyof typeof RUOLI] ?? u.ruolo}</Badge>
            {!u.attivo && <Badge color="red">Disattivato</Badge>}
            {u.attivo && invitoPendente && <Badge color={invitoScaduto ? "red" : "yellow"}>{invitoScaduto ? "Invito scaduto" : "Invito in attesa"}</Badge>}
            {u.assenzaOggi && (
              <Badge color="orange">
                <CalendarOff className="h-3 w-3" /> Assente ({TIPI_ASSENZA[u.assenzaOggi.tipo as keyof typeof TIPI_ASSENZA]?.toLowerCase() ?? u.assenzaOggi.tipo}) fino al{" "}
                {u.assenzaOggi.fineLabel}
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
            <a href={`mailto:${u.email}`} className="inline-flex min-w-0 items-center gap-1 hover:text-blue-700">
              <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{u.email}</span>
            </a>
            {u.telefono && (
              <a href={`tel:${u.telefono}`} className="inline-flex items-center gap-1 hover:text-blue-700">
                <Phone className="h-3.5 w-3.5 text-slate-400" /> {u.telefono}
              </a>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {u.hasGoogle ? (
              <Badge color="green" className="max-w-full">
                <MailCheck className="h-3 w-3" /> <span className="truncate">Gmail: {u.googleEmail}</span>
              </Badge>
            ) : (
              <Badge color="slate">Gmail non collegata</Badge>
            )}
            {u.attivo && (
              <>
                <Link
                  href={`/attivita?assegnatario=${u.id}&stato=aperte&ordina=scadenza`}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700 ring-1 ring-inset ring-blue-200 hover:bg-blue-100"
                >
                  {u.taskAperte} {u.taskAperte === 1 ? "attività aperta" : "attività aperte"}
                </Link>
                {u.taskScadute > 0 && (
                  <Link
                    href={`/attivita?assegnatario=${u.id}&stato=aperte&periodo=scadute&ordina=scadenza`}
                    className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-100"
                  >
                    <AlertTriangle className="h-3 w-3" /> {u.taskScadute} scadute
                  </Link>
                )}
              </>
            )}
            <span className="text-slate-400">{u.lastLoginLabel}</span>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
          <Button size="sm" variant="outline" onClick={onEdit} disabled={busy}>
            <Pencil className="h-4 w-4" /> Modifica
          </Button>
          {u.attivo && (
            <>
              <Button size="sm" variant="outline" onClick={onPassword} disabled={busy}>
                <KeyRound className="h-4 w-4" /> Password temporanea
              </Button>
              <Button size="sm" variant="outline" onClick={onResend} disabled={busy}>
                <Send className="h-4 w-4" /> {invitoPendente || !u.hasPassword ? "Reinvia invito" : "Invia invito"}
              </Button>
              {!isSelf && (
                <label className="inline-flex h-8 items-center gap-1.5 text-xs text-slate-600">
                  <span className="sr-only sm:not-sr-only">Ruolo</span>
                  <Select value={u.ruolo} onChange={(e) => onRole(e.target.value)} disabled={busy} className="h-8 w-auto py-0 text-xs" aria-label="Ruolo">
                    <option value="COLLABORATORE">{RUOLI.COLLABORATORE}</option>
                    <option value="ADMIN">{RUOLI.ADMIN}</option>
                  </Select>
                </label>
              )}
            </>
          )}
          {!isSelf && (
            <Button
              size="sm"
              variant="ghost"
              className={cn("ml-auto", u.attivo ? "text-red-600 hover:bg-red-50" : "text-green-700 hover:bg-green-50")}
              disabled={busy}
              onClick={() => {
                if (u.attivo && !window.confirm(`Disattivare ${u.nome}? Non potrà più accedere alla piattaforma.`)) return;
                onActive(!u.attivo);
              }}
            >
              {u.attivo ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              {u.attivo ? "Disattiva" : "Riattiva"}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Elenco
// ---------------------------------------------------------------------------
type ModalState = { kind: "none" } | { kind: "new" } | { kind: "edit"; utente: StaffRow } | { kind: "password"; utente: StaffRow };

export function StaffList({ staff, isAdmin, currentUserId }: { staff: StaffRow[]; isAdmin: boolean; currentUserId: string }) {
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [esito, setEsito] = useState<Esito | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const close = () => setModal({ kind: "none" });

  const run = async (fn: () => Promise<TeamActionState>) => {
    setError(null);
    setBusy(true);
    try {
      const r = await fn();
      if (r.error) setError(r.error);
      return r;
    } finally {
      setBusy(false);
    }
  };

  const attivi = staff.filter((s) => s.attivo);
  const disattivati = staff.filter((s) => !s.attivo);
  const title = modal.kind === "new" ? "Nuovo collaboratore" : modal.kind === "edit" ? "Modifica collaboratore" : modal.kind === "password" ? "Password temporanea" : "";

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={() => setModal({ kind: "new" })}>
            <Plus className="h-4 w-4" /> Nuovo collaboratore
          </Button>
        </div>
      )}
      {esito && <EsitoBox esito={esito} onDismiss={() => setEsito(null)} />}
      {error && <Alert kind="error">{error}</Alert>}

      {staff.length === 0 ? (
        <EmptyState icon={<Users />} title="Nessun collaboratore" description="Aggiungi i collaboratori dello studio per assegnare loro le attività." />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {attivi.map((u) => (
              <StaffCard
                key={u.id}
                u={u}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
                busy={busy}
                onEdit={() => setModal({ kind: "edit", utente: u })}
                onPassword={() => setModal({ kind: "password", utente: u })}
                onResend={async () => {
                  const r = await run(() => resendInviteAction(u.id));
                  if (r.ok && r.inviteLink) setEsito({ kind: "invito", nome: u.nome, email: u.email, link: r.inviteLink, emailSent: r.emailSent });
                }}
                onRole={(ruolo) => run(() => changeRoleAction(u.id, ruolo))}
                onActive={(attivo) => run(() => setStaffActiveAction(u.id, attivo))}
              />
            ))}
          </ul>
          {disattivati.length > 0 && (
            <section>
              <h2 className="mb-2 mt-6 flex items-center gap-2 text-sm font-semibold text-slate-500">
                <UserRound className="h-4 w-4" /> Disattivati ({disattivati.length})
              </h2>
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {disattivati.map((u) => (
                  <StaffCard
                    key={u.id}
                    u={u}
                    isAdmin={isAdmin}
                    currentUserId={currentUserId}
                    busy={busy}
                    onEdit={() => setModal({ kind: "edit", utente: u })}
                    onPassword={() => setModal({ kind: "password", utente: u })}
                    onResend={() => run(() => resendInviteAction(u.id))}
                    onRole={(ruolo) => run(() => changeRoleAction(u.id, ruolo))}
                    onActive={(attivo) => run(() => setStaffActiveAction(u.id, attivo))}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <Modal open={modal.kind !== "none"} onClose={close} title={title}>
        {modal.kind === "new" && (
          <NewStaffForm
            onCancel={close}
            onCreated={(e) => {
              setEsito(e);
              close();
            }}
          />
        )}
        {modal.kind === "edit" && <EditStaffForm utente={modal.utente} onDone={close} onCancel={close} />}
        {modal.kind === "password" && (
          <TempPasswordForm
            utente={modal.utente}
            onCancel={close}
            onDone={(e) => {
              setEsito(e);
              close();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
