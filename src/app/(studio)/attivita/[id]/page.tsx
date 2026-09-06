import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Building2, CalendarClock, FileText, Mail, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { isAdmin, requireStaff } from "@/lib/auth/guards";
import { CATEGORIE_ADEMPIMENTO, PRIORITA_TASK, STATI_TASK } from "@/lib/constants";
import { cn, describeDeadline, formatDate, formatDateLong, formatDateTime, toDateInputValue } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, PRIORITA_COLOR, STATO_TASK_COLOR } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { TaskEditModal } from "@/modules/attivita/TaskEditModal";
import { NoteForm, RiassegnaForm, StatoButtons } from "@/modules/attivita/TaskDetailForms";
import { eliminaTask } from "@/modules/attivita/actions";
import { caricaOpzioniForm } from "@/modules/attivita/opzioni";
import { capitalize, isTaskAperta, isTaskScaduta } from "@/modules/attivita/lib";

export const metadata: Metadata = { title: "Dettaglio attività" };

const PROMEMORIA: Record<string, string> = { PREAVVISO: "preavviso", DOMANI: "scade domani", OGGI: "scade oggi", SCADUTA: "scaduta" };

export default async function DettaglioAttivitaPage(props: PageProps<"/attivita/[id]">) {
  const user = await requireStaff();
  const { id } = await props.params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, denominazione: true, attivo: true } },
      assignee: { select: { id: true, nome: true, colore: true } },
      createdBy: { select: { id: true, nome: true } },
      template: { select: { id: true, nome: true, categoria: true, ricorrenza: true } },
      emails: { select: { id: true, subject: true, fromAddr: true, fromName: true, receivedAt: true }, orderBy: { receivedAt: "desc" } },
      documenti: { select: { id: true, nome: true, size: true, createdAt: true, daCliente: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!task) notFound();

  const { clienti, utenti, templates } = await caricaOpzioniForm({ includiClienteId: task.clientId, includiUtenteId: task.assigneeId });
  const aperta = isTaskAperta(task.stato);
  const scaduta = isTaskScaduta(task);
  const puoEliminare = isAdmin(user) || task.createdById === user.id;

  const valoriForm = {
    id: task.id,
    titolo: task.titolo,
    descrizione: task.descrizione,
    clientId: task.clientId,
    scadenza: toDateInputValue(task.scadenza),
    priorita: task.priorita,
    assigneeId: task.assigneeId,
    giorniPreavviso: task.giorniPreavviso,
    templateId: task.templateId,
  };

  const backHref = task.client ? `/clienti/${task.client.id}?tab=attivita` : "/attivita";

  return (
    <div className="pb-20 lg:pb-0">
      <PageHeader
        title={task.titolo}
        backHref="/attivita"
        backLabel="Attività"
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge color={STATO_TASK_COLOR[task.stato]}>{STATI_TASK[task.stato as keyof typeof STATI_TASK] ?? task.stato}</Badge>
            <Badge color={PRIORITA_COLOR[task.priorita]}>Priorità {PRIORITA_TASK[task.priorita as keyof typeof PRIORITA_TASK]?.toLowerCase() ?? task.priorita}</Badge>
            {scaduta && (
              <Badge color="red">
                <AlertTriangle className="h-3 w-3" /> Scaduta
              </Badge>
            )}
          </span>
        }
        actions={<TaskEditModal valori={valoriForm} clienti={clienti} utenti={utenti} templates={templates} />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className={cn("rounded-lg border px-3 py-2.5", scaduta ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50")}>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Scadenza</p>
                  <p className={cn("mt-0.5 flex items-center gap-2 text-sm font-semibold", scaduta ? "text-red-700" : "text-slate-900")}>
                    <CalendarClock className="h-4 w-4" />
                    {capitalize(formatDateLong(task.scadenza))}
                  </p>
                  <p className={cn("text-xs", scaduta ? "text-red-600" : "text-slate-500")}>
                    {aperta ? capitalize(describeDeadline(task.scadenza)) : task.completatoAt ? `Completata il ${formatDate(task.completatoAt)}` : "Chiusa"}
                    {aperta && ` · promemoria ${task.giorniPreavviso} giorni prima`}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Cliente</p>
                  {task.client ? (
                    <Link href={`/clienti/${task.client.id}`} className="mt-0.5 flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline">
                      <Building2 className="h-4 w-4" />
                      {task.client.denominazione}
                      {!task.client.attivo && <Badge color="orange">Archiviato</Badge>}
                    </Link>
                  ) : (
                    <p className="mt-0.5 text-sm text-slate-600">Attività interna allo studio</p>
                  )}
                  <Link href={backHref} className="text-xs text-slate-500 hover:text-blue-700">
                    {task.client ? "Vedi tutte le attività del cliente" : "Torna all'elenco"}
                  </Link>
                </div>
              </div>

              {task.descrizione ? (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Descrizione</p>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{task.descrizione}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Nessuna descrizione.</p>
              )}

              <div className="hidden border-t border-slate-100 pt-4 lg:block">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Stato</p>
                <StatoButtons id={task.id} stato={task.stato} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Note interne" description="Appunti dello studio su questa attività." />
            <CardBody>
              <NoteForm id={task.id} note={task.note} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Email collegate" description={task.emails.length ? `${task.emails.length} email` : "Nessuna email collegata"} />
            {task.emails.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {task.emails.map((e) => (
                  <li key={e.id}>
                    <Link href={`/email/${e.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                      <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{e.subject || "(senza oggetto)"}</p>
                        <p className="truncate text-xs text-slate-500">
                          {e.fromName ? `${e.fromName} <${e.fromAddr}>` : e.fromAddr} · {formatDateTime(e.receivedAt)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Documenti collegati" description={task.documenti.length ? `${task.documenti.length} documenti` : "Nessun documento collegato"} />
            {task.documenti.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {task.documenti.map((d) => (
                  <li key={d.id}>
                    <a href={`/api/documenti/${d.id}`} target="_blank" rel="noopener" className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{d.nome}</p>
                        <p className="text-xs text-slate-500">
                          {formatDate(d.createdAt)}
                          {d.daCliente ? " · caricato dal cliente" : ""}
                        </p>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Assegnazione" />
            <CardBody className="space-y-3">
              <div className="flex items-center gap-3">
                {task.assignee ? (
                  <>
                    <Avatar nome={task.assignee.nome} colore={task.assignee.colore} size="md" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{task.assignee.nome}</p>
                      <p className="text-xs text-slate-500">{task.assignee.id === user.id ? "Assegnata a te" : "Assegnatario"}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Nessun assegnatario.</p>
                )}
              </div>
              <RiassegnaForm id={task.id} assigneeId={task.assigneeId} utenti={utenti} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Dettagli" />
            <CardBody>
              <dl className="space-y-2 text-sm">
                <Riga label="Adempimento">
                  {task.template ? (
                    <Link href={isAdmin(user) ? `/adempimenti/${task.template.id}` : `/adempimenti#${task.template.categoria}`} className="text-blue-700 hover:underline">
                      {task.template.nome}
                    </Link>
                  ) : (
                    "Attività manuale"
                  )}
                </Riga>
                {task.template && <Riga label="Categoria">{CATEGORIE_ADEMPIMENTO[task.template.categoria as keyof typeof CATEGORIE_ADEMPIMENTO] ?? task.template.categoria}</Riga>}
                {task.periodo && <Riga label="Periodo">{task.periodo}</Riga>}
                {task.anno && <Riga label="Anno">{task.anno}</Riga>}
                <Riga label="Preavviso">{task.giorniPreavviso} giorni</Riga>
                <Riga label="Creata da">{task.createdBy?.nome ?? "—"}</Riga>
                <Riga label="Creata il">{formatDateTime(task.createdAt)}</Riga>
                <Riga label="Ultima modifica">{formatDateTime(task.updatedAt)}</Riga>
                {task.completatoAt && <Riga label="Completata il">{formatDateTime(task.completatoAt)}</Riga>}
                <Riga label="Promemoria">
                  {task.lastReminderKind ? `${PROMEMORIA[task.lastReminderKind] ?? task.lastReminderKind} (${formatDateTime(task.lastReminderAt)})` : "nessuno inviato"}
                </Riga>
              </dl>
            </CardBody>
          </Card>

          {puoEliminare && (
            <Card className="border-red-100">
              <CardBody className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">L&apos;eliminazione è definitiva.</p>
                <form action={eliminaTask}>
                  <input type="hidden" name="id" value={task.id} />
                  <ConfirmButton message="Eliminare definitivamente questa attività?" variant="danger" size="sm">
                    <Trash2 className="h-4 w-4" /> Elimina
                  </ConfirmButton>
                </form>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* Barra azioni fissa su mobile: ancorata sopra la bottom nav (3.5rem + area sicura iPhone/PWA) */}
      <div className="fixed inset-x-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-2 backdrop-blur lg:hidden" style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))" }}>
        <StatoButtons id={task.id} stato={task.stato} compact />
      </div>
    </div>
  );
}

function Riga({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right text-slate-800">{children}</dd>
    </div>
  );
}
