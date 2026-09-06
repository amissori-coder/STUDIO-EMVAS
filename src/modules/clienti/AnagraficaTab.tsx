import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, ClipboardList, Mail } from "lucide-react";
import type { CurrentUser } from "@/lib/auth/guards";
import { PERIODICITA_IVA, REGIMI_FISCALI, STATI_TASK, TIPI_SOGGETTO } from "@/lib/constants";
import { describeDeadline, formatDate, formatDateTime } from "@/lib/utils";
import { Badge, PRIORITA_COLOR, STATO_TASK_COLOR } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { ContactsCard } from "./ContactsCard";
import { canManagePortalAccess } from "./permessi";
import { PortalAccessCard } from "./PortalAccessCard";
import { getClientSummary, type ClientWithReferente } from "./queries";

function Row({ label, children, span }: { label: string; children: ReactNode; span?: boolean }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className={span ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={"mt-0.5 break-words text-sm " + (empty ? "text-slate-400" : "text-slate-900")}>{empty ? "—" : children}</dd>
    </div>
  );
}

export async function AnagraficaTab({ client, user }: { client: ClientWithReferente; user: CurrentUser }) {
  const s = await getClientSummary(client.id);
  const indirizzo = [client.indirizzo, [client.cap, client.comune].filter(Boolean).join(" "), client.provincia ? `(${client.provincia})` : ""]
    .filter(Boolean)
    .join(", ")
    .replace(", (", " (");
  const haIva = !!client.partitaIva && client.regimeFiscale !== "NON_TITOLARE";
  const canManagePortal = canManagePortalAccess(user, client);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card>
          <CardHeader title="Dati anagrafici" />
          <CardBody>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <Row label="Denominazione" span>
                {client.denominazione}
              </Row>
              <Row label="Tipo soggetto">{TIPI_SOGGETTO[client.tipoSoggetto as keyof typeof TIPI_SOGGETTO] ?? client.tipoSoggetto}</Row>
              <Row label="Regime fiscale">{REGIMI_FISCALI[client.regimeFiscale as keyof typeof REGIMI_FISCALI] ?? client.regimeFiscale}</Row>
              <Row label="Codice fiscale">{client.codiceFiscale && <span className="font-mono">{client.codiceFiscale}</span>}</Row>
              <Row label="Partita IVA">{client.partitaIva && <span className="font-mono">{client.partitaIva}</span>}</Row>
              <Row label="Codice ATECO">{client.codiceAteco}</Row>
              <Row label="Attività">{client.attivita}</Row>
              <Row label="Email">{client.email && <a href={`mailto:${client.email}`} className="text-blue-700 hover:underline">{client.email}</a>}</Row>
              <Row label="PEC">{client.pec && <a href={`mailto:${client.pec}`} className="text-blue-700 hover:underline">{client.pec}</a>}</Row>
              <Row label="Telefono">{client.telefono && <a href={`tel:${client.telefono.replace(/\s+/g, "")}`} className="text-blue-700 hover:underline">{client.telefono}</a>}</Row>
              <Row label="Sede">{indirizzo}</Row>
              <Row label="Referente dello studio">
                {client.referente && (
                  <span className="inline-flex items-center gap-2">
                    <Avatar nome={client.referente.nome} colore={client.referente.colore} size="xs" />
                    {client.referente.nome}
                  </span>
                )}
              </Row>
              <Row label="Stato">{client.attivo ? <Badge color="green">Attivo</Badge> : <Badge color="orange">Archiviato</Badge>}</Row>
              <Row label="Creato il">{formatDate(client.createdAt)}</Row>
              <Row label="Ultima modifica">{formatDateTime(client.updatedAt)}</Row>
            </dl>
          </CardBody>
        </Card>

        {client.note && (
          <Card>
            <CardHeader title="Note interne" />
            <CardBody>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{client.note}</p>
            </CardBody>
          </Card>
        )}

        <ContactsCard clientId={client.id} contatti={s.contatti} />

        <PortalAccessCard
          clientId={client.id}
          utenti={s.utenti.map((cu) => ({
            id: cu.user.id,
            nome: cu.user.nome,
            email: cu.user.email,
            attivo: cu.user.attivo,
            colore: cu.user.colore,
            ultimoAccesso: cu.user.lastLoginAt ? formatDateTime(cu.user.lastLoginAt) : null,
          }))}
          canManage={canManagePortal}
        />
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader
            title="Riepilogo"
            actions={
              <Link href={`/clienti/${client.id}?tab=attivita`} className="text-sm font-medium text-blue-700 hover:underline">
                Tutte le attività
              </Link>
            }
          />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Link href={`/clienti/${client.id}?tab=attivita`} className="rounded-lg bg-slate-50 p-3 hover:bg-slate-100">
                <p className="text-xs text-slate-500">Attività aperte</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{s.taskAperte}</p>
              </Link>
              <Link href={`/clienti/${client.id}?tab=attivita`} className={"rounded-lg p-3 " + (s.taskScadute > 0 ? "bg-red-50 hover:bg-red-100" : "bg-slate-50 hover:bg-slate-100")}>
                <p className={"text-xs " + (s.taskScadute > 0 ? "text-red-600" : "text-slate-500")}>Scadute</p>
                <p className={"mt-1 text-2xl font-semibold " + (s.taskScadute > 0 ? "text-red-700" : "text-slate-900")}>{s.taskScadute}</p>
              </Link>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                <CalendarClock className="h-3.5 w-3.5" /> Prossime scadenze
              </p>
              {s.prossime.length === 0 ? (
                <p className="text-sm text-slate-400">Nessuna scadenza in programma.</p>
              ) : (
                <ul className="space-y-2">
                  {s.prossime.map((t) => (
                    <li key={t.id}>
                      <Link href={`/attivita/${t.id}`} className="block rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50">
                        <p className="truncate text-sm font-medium text-slate-900">{t.titolo}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span>
                            {formatDate(t.scadenza)} · {describeDeadline(t.scadenza)}
                          </span>
                          <Badge color={STATO_TASK_COLOR[t.stato]}>{STATI_TASK[t.stato as keyof typeof STATI_TASK] ?? t.stato}</Badge>
                          {t.priorita === "ALTA" && <Badge color={PRIORITA_COLOR[t.priorita]}>Alta</Badge>}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-start gap-2 border-t border-slate-100 pt-3 text-sm">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              {s.ultimaEmail ? (
                <div className="min-w-0">
                  <p className="text-slate-500">Ultima email: {formatDateTime(s.ultimaEmail.receivedAt)}</p>
                  <Link href={`/email/${s.ultimaEmail.id}`} className="block truncate text-blue-700 hover:underline">
                    {s.ultimaEmail.subject || "(senza oggetto)"}
                  </Link>
                </div>
              ) : (
                <p className="text-slate-400">Nessuna email collegata.</p>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Profilo adempimenti" description="Dati usati dal pianificatore delle scadenze." />
          <CardBody>
            <dl className="space-y-3">
              <Row label="Regime fiscale">{REGIMI_FISCALI[client.regimeFiscale as keyof typeof REGIMI_FISCALI] ?? client.regimeFiscale}</Row>
              <Row label="Periodicità IVA">{PERIODICITA_IVA[client.periodicitaIva as keyof typeof PERIODICITA_IVA] ?? client.periodicitaIva}</Row>
              <Row label="Titolare di partita IVA">{haIva ? "Sì" : "No"}</Row>
              <Row label="Dipendenti">{client.haDipendenti ? "Sì" : "No"}</Row>
            </dl>
            {!haIva && client.regimeFiscale !== "NON_TITOLARE" && (
              <p className="mt-3 flex items-start gap-2 rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Partita IVA mancante: gli adempimenti IVA non verranno pianificati.
              </p>
            )}
            <Link href="/adempimenti" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline">
              <ClipboardList className="h-4 w-4" /> Vai agli adempimenti
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
