import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, ExternalLink, ListChecks, MessagesSquare, Paperclip, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { findClientByEmails, gmailWebUrl, sanitizeEmailHtml } from "@/lib/gmail";
import { STATI_TASK, STATI_TASK_APERTI } from "@/lib/constants";
import { formatDate, formatDateTime, formatRelative, truncate } from "@/lib/utils";
import { Badge, STATO_TASK_COLOR } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ArchiveButton } from "@/modules/email/ArchiveButton";
import { AssociationForm } from "@/modules/email/AssociationForm";
import { AttachmentSaveForm } from "@/modules/email/AttachmentSaveForm";
import { EmailBody } from "@/modules/email/EmailBody";
import { EmailSender } from "@/modules/email/EmailRow";
import { getEmailDetail, listActiveClientsForSelect, parseAttachments, splitAddresses } from "@/modules/email/queries";

export async function generateMetadata(props: PageProps<"/email/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const email = await prisma.emailMessage.findUnique({ where: { id }, select: { subject: true } });
  return { title: email ? truncate(email.subject, 60) : "Email" };
}

export default async function EmailDetailPage(props: PageProps<"/email/[id]">) {
  await requireStaff();
  const { id } = await props.params;
  const email = await getEmailDetail(id);
  if (!email) notFound();

  if (email.isUnread) {
    await prisma.emailMessage.update({ where: { id }, data: { isUnread: false } });
  }

  const toAddrs = splitAddresses(email.toAddrs);
  const ccAddrs = splitAddresses(email.ccAddrs);
  const attachments = parseAttachments(email.attachments);

  const [thread, clienti, suggestedId, folders] = await Promise.all([
    prisma.emailMessage.findMany({
      where: { threadId: email.threadId, accountId: email.accountId, id: { not: email.id } },
      select: { id: true, subject: true, fromAddr: true, fromName: true, receivedAt: true, isUnread: true },
      orderBy: { receivedAt: "asc" },
    }),
    listActiveClientsForSelect(),
    email.clientId ? Promise.resolve(null) : findClientByEmails([email.fromAddr, ...toAddrs, ...ccAddrs]),
    email.clientId
      ? prisma.documentFolder.findMany({ where: { clientId: email.clientId }, select: { id: true, nome: true }, orderBy: [{ ordine: "asc" }, { nome: "asc" }] })
      : Promise.resolve([]),
  ]);
  const suggested = suggestedId ? (clienti.find((c) => c.id === suggestedId) ?? null) : null;
  const defaultFolderId = folders.find((f) => f.nome === "Altro")?.id ?? folders[0]?.id ?? null;
  const savedNames = new Set(email.documenti.map((d) => d.nome));
  const bodyHtml = email.bodyHtml ? sanitizeEmailHtml(email.bodyHtml) : null;

  const creaAttivitaHref = `/attivita/nuova?${new URLSearchParams({
    ...(email.clientId ? { cliente: email.clientId } : {}),
    titolo: email.subject,
  }).toString()}`;

  return (
    <>
      <PageHeader
        title={email.subject || "(senza oggetto)"}
        backHref="/email"
        backLabel="Casella email"
        actions={
          <>
            <Button href={creaAttivitaHref} variant="secondary">
              <Plus className="h-4 w-4" /> Crea attività
            </Button>
            <ArchiveButton emailId={email.id} archiviata={email.archiviata} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-3">
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                <dt className="text-slate-500">Da</dt>
                <dd className="min-w-0 break-words">
                  <EmailSender email={email} />
                </dd>
                <dt className="text-slate-500">A</dt>
                <dd className="min-w-0 break-words text-slate-700">{toAddrs.join(", ") || "—"}</dd>
                {ccAddrs.length > 0 && (
                  <>
                    <dt className="text-slate-500">Cc</dt>
                    <dd className="min-w-0 break-words text-slate-700">{ccAddrs.join(", ")}</dd>
                  </>
                )}
                <dt className="text-slate-500">Data</dt>
                <dd className="text-slate-700">
                  {formatDateTime(email.receivedAt)} <span className="text-slate-400">({formatRelative(email.receivedAt)})</span>
                </dd>
                <dt className="text-slate-500">Casella</dt>
                <dd className="min-w-0 break-words text-slate-700">
                  {email.account.googleEmail} <span className="text-slate-400">· {email.account.user.nome}</span>
                </dd>
              </dl>
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                {email.archiviata && <Badge color="slate">Archiviata</Badge>}
                {attachments.length > 0 && (
                  <Badge color="slate">
                    <Paperclip className="h-3 w-3" /> {attachments.length} {attachments.length === 1 ? "allegato" : "allegati"}
                  </Badge>
                )}
                <a
                  href={gmailWebUrl(email.account.googleEmail, email.gmailId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex min-h-10 items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" /> Apri in Gmail
                </a>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <EmailBody bodyHtml={bodyHtml} bodyText={email.bodyText} />
            </CardBody>
          </Card>

          {attachments.length > 0 && (
            <Card>
              <CardHeader
                title={`Allegati (${attachments.length})`}
                description={email.clientId ? "Salva gli allegati direttamente nell'area documenti del cliente." : "Associa l'email a un cliente per salvare gli allegati tra i suoi documenti."}
              />
              <CardBody>
                <ul className="space-y-2">
                  {attachments.map((a) => (
                    <AttachmentSaveForm
                      key={a.attachmentId}
                      emailId={email.id}
                      attachment={a}
                      folders={folders}
                      defaultFolderId={defaultFolderId}
                      enabled={!!email.clientId}
                      alreadySaved={savedNames.has(a.filename)}
                    />
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}

          {thread.length > 0 && (
            <Card>
              <CardHeader title="Conversazione" description={`Altri ${thread.length} ${thread.length === 1 ? "messaggio" : "messaggi"} nello stesso thread`} />
              <ul className="divide-y divide-slate-100">
                {thread.map((m) => (
                  <li key={m.id}>
                    <Link href={`/email/${m.id}`} className="flex flex-col gap-0.5 px-4 py-3 hover:bg-slate-50 sm:flex-row sm:items-baseline sm:justify-between sm:px-5">
                      <span className="min-w-0 truncate text-sm">
                        <MessagesSquare className="mr-1.5 inline h-3.5 w-3.5 text-slate-400" />
                        <span className={m.isUnread ? "font-semibold text-slate-900" : "font-medium text-slate-800"}>{m.fromName || m.fromAddr}</span>
                        <span className="text-slate-500"> · {m.subject || "(senza oggetto)"}</span>
                      </span>
                      <span className="shrink-0 text-xs text-slate-500">{formatDateTime(m.receivedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Associazione" description="Collega l'email a un cliente e, se utile, a un'attività" />
            <CardBody className="space-y-4">
              {email.client ? (
                <div className="space-y-2 text-sm">
                  <p className="flex items-start gap-2">
                    <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0">
                      <Link href={`/clienti/${email.client.id}`} className="font-medium text-blue-700 hover:underline">
                        {email.client.denominazione}
                      </Link>
                      <span className="block text-xs text-slate-500">
                        {email.linkAuto ? "Associata automaticamente" : `Associata da ${email.linkedBy?.nome ?? "staff"}`}
                        {email.linkedAt ? ` · ${formatDate(email.linkedAt)}` : ""}
                      </span>
                    </span>
                  </p>
                  {email.task ? (
                    <p className="flex items-start gap-2">
                      <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <span className="min-w-0">
                        <Link href={`/attivita/${email.task.id}`} className="font-medium text-blue-700 hover:underline">
                          {email.task.titolo}
                        </Link>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <Badge color={STATO_TASK_COLOR[email.task.stato] ?? "slate"}>{STATI_TASK[email.task.stato as keyof typeof STATI_TASK] ?? email.task.stato}</Badge>
                          scadenza {formatDate(email.task.scadenza)}
                        </span>
                      </span>
                    </p>
                  ) : (
                    <p className="flex items-center gap-2 text-slate-500">
                      <ListChecks className="h-4 w-4 shrink-0 text-slate-300" /> Nessuna attività collegata
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Non associata a nessun cliente.</p>
              )}
              <div className="border-t border-slate-100 pt-4">
                <AssociationForm
                  emailId={email.id}
                  currentClientId={email.clientId}
                  currentTaskId={email.taskId}
                  currentTask={
                    email.task
                      ? {
                          id: email.task.id,
                          titolo: email.task.titolo,
                          scadenzaLabel: `${formatDate(email.task.scadenza)}${(STATI_TASK_APERTI as string[]).includes(email.task.stato) ? "" : ` (${STATI_TASK[email.task.stato as keyof typeof STATI_TASK] ?? email.task.stato})`}`,
                        }
                      : null
                  }
                  clienti={clienti}
                  suggested={suggested}
                />
              </div>
            </CardBody>
          </Card>

          {email.documenti.length > 0 && (
            <Card>
              <CardHeader title="Documenti salvati da questa email" />
              <ul className="divide-y divide-slate-100 text-sm">
                {email.documenti.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 px-4 py-2 sm:px-5">
                    <span className="min-w-0 truncate">{d.nome}</span>
                    <span className="shrink-0 text-xs text-slate-500">{formatDate(d.createdAt)}</span>
                  </li>
                ))}
              </ul>
              {email.clientId && (
                <CardBody className="border-t border-slate-100 py-2">
                  <Link href={`/clienti/${email.clientId}?tab=documenti`} className="text-sm font-medium text-blue-700 hover:underline">
                    Apri i documenti del cliente
                  </Link>
                </CardBody>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
