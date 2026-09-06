import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, ChevronLeft, Mail, MapPin, Pencil, Phone, Trash2 } from "lucide-react";
import { requireStaff } from "@/lib/auth/guards";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs } from "@/components/ui/Tabs";
import { ClientTasksTab } from "@/modules/attivita/ClientTasksTab";
import { ClientEmailsTab } from "@/modules/email/ClientEmailsTab";
import { ClientChatPanel } from "@/modules/chat/ClientChatPanel";
import { ClientDocumentsTab } from "@/modules/documenti/ClientDocumentsTab";
import { AnagraficaTab } from "@/modules/clienti/AnagraficaTab";
import { ClientBadges } from "@/modules/clienti/ClientBadges";
import { deleteClientAction, setClientArchivedAction } from "@/modules/clienti/actions";
import { getClientOrNotFound } from "@/modules/clienti/queries";

const TABS = ["anagrafica", "attivita", "email", "chat", "documenti"] as const;
type Tab = (typeof TABS)[number];

const MESSAGGI: Record<string, string> = {
  creato: "Cliente creato. Le cartelle documenti predefinite sono state generate.",
  salvato: "Modifiche salvate.",
  archiviato: "Cliente archiviato: non compare più tra i clienti attivi.",
  riattivato: "Cliente riattivato.",
};

export async function generateMetadata(props: PageProps<"/clienti/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const client = await getClientOrNotFound(id);
  return { title: client.denominazione };
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-12 text-sm text-slate-500">
      <Spinner className="h-4 w-4" /> {label}
    </div>
  );
}

export default async function ClientePage(props: PageProps<"/clienti/[id]">) {
  const user = await requireStaff();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const client = await getClientOrNotFound(id);
  const rawTab = typeof sp.tab === "string" ? sp.tab : "anagrafica";
  const tab: Tab = (TABS as readonly string[]).includes(rawTab) ? (rawTab as Tab) : "anagrafica";
  const messaggio = typeof sp.messaggio === "string" ? MESSAGGI[sp.messaggio] : undefined;
  const isAdmin = user.ruolo === "ADMIN";
  const base = `/clienti/${client.id}`;
  const luogo = [client.comune, client.provincia ? `(${client.provincia})` : ""].filter(Boolean).join(" ");

  return (
    <>
      <div className="mb-5">
        <Link href="/clienti" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ChevronLeft className="h-4 w-4" /> Clienti
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{client.denominazione}</h1>
            <div className="mt-2">
              <ClientBadges tipoSoggetto={client.tipoSoggetto} regimeFiscale={client.regimeFiscale} attivo={client.attivo} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
              {client.referente ? (
                <span className="inline-flex items-center gap-2" title="Referente dello studio">
                  <Avatar nome={client.referente.nome} colore={client.referente.colore} size="xs" />
                  {client.referente.nome}
                </span>
              ) : (
                <span className="text-slate-400">Nessun referente</span>
              )}
              {luogo && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-slate-400" /> {luogo}
                </span>
              )}
              {client.email && (
                <a href={`mailto:${client.email}`} className="inline-flex min-h-8 items-center gap-1 text-blue-700 hover:underline">
                  <Mail className="h-4 w-4" /> <span className="break-all">{client.email}</span>
                </a>
              )}
              {client.telefono && (
                <a href={`tel:${client.telefono.replace(/\s+/g, "")}`} className="inline-flex min-h-8 items-center gap-1 text-blue-700 hover:underline">
                  <Phone className="h-4 w-4" /> {client.telefono}
                </a>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
            <Button href={`${base}/modifica`} variant="primary">
              <Pencil className="h-4 w-4" /> Modifica
            </Button>
            {isAdmin && (
              <>
                <form action={setClientArchivedAction.bind(null, client.id, client.attivo)}>
                  <Button type="submit" variant="outline">
                    {client.attivo ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                    {client.attivo ? "Archivia" : "Riattiva"}
                  </Button>
                </form>
                <form action={deleteClientAction.bind(null, client.id)}>
                  <ConfirmButton
                    variant="danger"
                    message={`Eliminare definitivamente "${client.denominazione}"? Verranno cancellati anche attività, documenti, chat e accessi al portale collegati. L'operazione non è reversibile.`}
                  >
                    <Trash2 className="h-4 w-4" /> Elimina
                  </ConfirmButton>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      {messaggio && (
        <Alert kind="success" className="mb-4">
          {messaggio}
        </Alert>
      )}
      {!client.attivo && (
        <Alert kind="warning" className="mb-4">
          Questo cliente è archiviato. {isAdmin ? "Puoi riattivarlo con il pulsante «Riattiva»." : "Un amministratore può riattivarlo."}
        </Alert>
      )}

      <Tabs
        param="tab"
        defaultKey="anagrafica"
        className="mb-5"
        items={[
          { key: "anagrafica", label: "Anagrafica", href: base },
          { key: "attivita", label: "Attività", href: `${base}?tab=attivita` },
          { key: "email", label: "Email", href: `${base}?tab=email` },
          { key: "chat", label: "Chat", href: `${base}?tab=chat` },
          { key: "documenti", label: "Documenti", href: `${base}?tab=documenti` },
        ]}
      />

      {tab === "anagrafica" && (
        <Suspense fallback={<Loading label="Caricamento anagrafica…" />}>
          <AnagraficaTab client={client} user={user} />
        </Suspense>
      )}
      {tab === "attivita" && (
        <Suspense fallback={<Loading label="Caricamento attività…" />}>
          <ClientTasksTab clientId={client.id} user={user} />
        </Suspense>
      )}
      {tab === "email" && (
        <Suspense fallback={<Loading label="Caricamento email…" />}>
          <ClientEmailsTab clientId={client.id} user={user} />
        </Suspense>
      )}
      {tab === "chat" && (
        <Suspense fallback={<Loading label="Caricamento chat…" />}>
          <ClientChatPanel clientId={client.id} user={user} />
        </Suspense>
      )}
      {tab === "documenti" && (
        <Suspense fallback={<Loading label="Caricamento documenti…" />}>
          <ClientDocumentsTab clientId={client.id} user={user} />
        </Suspense>
      )}
    </>
  );
}
