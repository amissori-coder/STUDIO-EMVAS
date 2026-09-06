import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Briefcase, ChevronRight, MapPin, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth/guards";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ClientBadges } from "@/modules/clienti/ClientBadges";
import { ClientFilters } from "@/modules/clienti/ClientFilters";
import { getStaffUsers, listClients, type ClientListRow } from "@/modules/clienti/queries";

export const metadata: Metadata = { title: "Clienti" };

const MESSAGGI: Record<string, string> = {
  eliminato: "Cliente eliminato definitivamente.",
};

function str(v: string | string[] | undefined) {
  return typeof v === "string" ? v : "";
}

function TaskCounters({ c }: { c: ClientListRow }) {
  if (c.taskAperte === 0) return <span className="text-sm text-slate-400">Nessuna</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge color="blue">{c.taskAperte} aperte</Badge>
      {c.taskScadute > 0 && (
        <Badge color="red">
          <AlertTriangle className="h-3 w-3" /> {c.taskScadute} scadute
        </Badge>
      )}
    </span>
  );
}

function Luogo({ c }: { c: ClientListRow }) {
  if (!c.comune && !c.provincia) return <span className="text-slate-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <MapPin className="h-3.5 w-3.5 text-slate-400" />
      {c.comune}
      {c.provincia && <span className="text-slate-500">({c.provincia})</span>}
    </span>
  );
}

export default async function ClientiPage(props: PageProps<"/clienti">) {
  await requireStaff();
  const sp = await props.searchParams;
  const values = { q: str(sp.q), regime: str(sp.regime), tipo: str(sp.tipo), referente: str(sp.referente), stato: str(sp.stato) };
  const stato = values.stato === "archiviati" || values.stato === "tutti" ? values.stato : "attivi";
  const messaggio = str(sp.messaggio);

  const [clients, staff] = await Promise.all([
    listClients({ q: values.q, regime: values.regime, tipo: values.tipo, referente: values.referente, stato }),
    getStaffUsers(),
  ]);
  const hasFilters = !!(values.q || values.regime || values.tipo || values.referente || stato !== "attivi");

  return (
    <>
      <PageHeader
        title="Clienti"
        description="Anagrafica dei clienti dello studio."
        actions={
          <Button href="/clienti/nuovo">
            <Plus className="h-4 w-4" /> Nuovo cliente
          </Button>
        }
      />

      {messaggio && MESSAGGI[messaggio] && (
        <Alert kind="success" className="mb-4">
          {MESSAGGI[messaggio]}
        </Alert>
      )}

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <ClientFilters values={{ ...values, stato }} staff={staff} />
      </div>

      <p className="mb-3 text-sm text-slate-500" aria-live="polite">
        {clients.length === 0 ? "Nessun cliente" : clients.length === 1 ? "1 cliente" : `${clients.length} clienti`}
        {stato === "archiviati" ? " archiviati" : stato === "tutti" ? " (attivi e archiviati)" : ""}
        {hasFilters && values.q ? ` per “${values.q}”` : ""}
      </p>

      {clients.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={<Briefcase />}
            title="Nessun cliente corrisponde ai filtri"
            description="Prova a modificare la ricerca o ad azzerare i filtri."
            action={
              <Button variant="outline" href="/clienti">
                Azzera filtri
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<Briefcase />}
            title="Nessun cliente registrato"
            description="Inizia creando la scheda del primo cliente dello studio."
            action={
              <Button href="/clienti/nuovo">
                <Plus className="h-4 w-4" /> Nuovo cliente
              </Button>
            }
          />
        )
      ) : (
        <>
          {/* Mobile: card */}
          <ul className="space-y-3 md:hidden">
            {clients.map((c) => (
              <li key={c.id}>
                <Link href={`/clienti/${c.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-slate-900">{c.denominazione}</p>
                      <div className="mt-1.5">
                        <ClientBadges tipoSoggetto={c.tipoSoggetto} regimeFiscale={c.regimeFiscale} attivo={c.attivo} />
                      </div>
                    </div>
                    <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400" />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                    <Luogo c={c} />
                    <TaskCounters c={c} />
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                    {c.referente ? (
                      <>
                        <Avatar nome={c.referente.nome} colore={c.referente.colore} size="xs" />
                        <span className="truncate">{c.referente.nome}</span>
                      </>
                    ) : (
                      <span className="text-slate-400">Nessun referente</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: tabella */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Inquadramento</th>
                    <th className="px-4 py-3">Referente</th>
                    <th className="px-4 py-3">Comune</th>
                    <th className="px-4 py-3">Attività</th>
                    <th className="px-2 py-3" aria-label="Apri" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="max-w-xs px-4 py-3">
                        <Link href={`/clienti/${c.id}`} className="block truncate font-medium text-slate-900 hover:text-blue-700">
                          {c.denominazione}
                        </Link>
                        {(c.partitaIva || c.codiceFiscale) && (
                          <p className="truncate text-xs text-slate-500">{c.partitaIva ? `P. IVA ${c.partitaIva}` : `C.F. ${c.codiceFiscale}`}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ClientBadges tipoSoggetto={c.tipoSoggetto} regimeFiscale={c.regimeFiscale} attivo={c.attivo} />
                      </td>
                      <td className="px-4 py-3">
                        {c.referente ? (
                          <span className="inline-flex items-center gap-2">
                            <Avatar nome={c.referente.nome} colore={c.referente.colore} size="xs" />
                            <span className="text-slate-700">{c.referente.nome}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <Luogo c={c} />
                      </td>
                      <td className="px-4 py-3">
                        <TaskCounters c={c} />
                      </td>
                      <td className="px-2 py-3 text-right">
                        <Link href={`/clienti/${c.id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`Apri ${c.denominazione}`}>
                          <ChevronRight className="h-5 w-5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
