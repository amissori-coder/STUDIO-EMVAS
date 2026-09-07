import type { Metadata } from "next";
import { Building2, Clock, FolderOpen, Info, UserRound } from "lucide-react";
import { requireClientUser } from "@/lib/auth/guards";
import { Alert } from "@/components/ui/Alert";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PortalDocumentList } from "@/modules/portale/PortalDocumentList";
import { PortalFolderCard } from "@/modules/portale/PortalFolderCard";
import { getPortalClients, getPortalFolderTree, getPortalRecentDocuments, resolvePortalClient, type PortalFolder } from "@/modules/portale/service";

export const metadata: Metadata = { title: "Area clienti" };

function folderNameMap(nodes: PortalFolder[], map = new Map<string, string>()) {
  for (const n of nodes) {
    map.set(n.id, n.nome);
    folderNameMap(n.children, map);
  }
  return map;
}

export default async function PortalePage(props: PageProps<"/portale">) {
  const user = await requireClientUser();
  const sp = await props.searchParams;
  const requested = typeof sp.cliente === "string" ? sp.cliente : null;
  const clients = await getPortalClients(user);
  // `?cliente=` ha la precedenza sul cookie; il selettore nell'intestazione lo legge e allinea il cookie.
  const client = await resolvePortalClient(clients, requested);

  if (!client) {
    return (
      <>
        <h1 className="mb-4 text-xl font-semibold text-slate-900 sm:text-2xl">Ciao {user.nome}</h1>
        <EmptyState
          icon={<Building2 />}
          title="Il tuo accesso non è ancora collegato a un'azienda"
          description="Lo studio deve associare il tuo utente a un cliente per mostrarti le cartelle dei documenti. Contatta lo studio per completare l'attivazione."
        />
      </>
    );
  }

  const [folders, recenti] = await Promise.all([getPortalFolderTree(client.id), getPortalRecentDocuments(user, client.id, 8)]);
  const nomi = folderNameMap(folders);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Ciao {user.nome}, benvenuto nell&apos;area documenti di</p>
        <h1 className="mt-0.5 text-xl font-semibold text-slate-900 sm:text-2xl">{client.denominazione}</h1>
        {client.referente && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-600">
            <UserRound className="h-4 w-4 text-slate-400" /> Il tuo referente in studio: <span className="font-medium">{client.referente.nome}</span>
          </p>
        )}
      </div>

      <Alert kind="info" title="Come funziona">
        Carica qui i documenti richiesti dallo studio: apri la cartella giusta, tocca «Scegli file» (oppure «Scatta una foto» dal telefono) e conferma.
        Lo studio riceve subito un avviso per ogni caricamento.
      </Alert>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
          <FolderOpen className="h-5 w-5 text-blue-600" /> Le tue cartelle
        </h2>
        {folders.length === 0 ? (
          <EmptyState icon={<FolderOpen />} title="Nessuna cartella disponibile" description="Lo studio non ha ancora predisposto cartelle per i tuoi documenti. Contatta lo studio se pensi sia un errore." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {folders.map((f) => (
              <PortalFolderCard key={f.id} folder={f} />
            ))}
          </div>
        )}
      </section>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-slate-400" /> Ultimi documenti caricati
            </span>
          }
          description="I file più recenti, tuoi e dello studio."
        />
        {recenti.length === 0 ? (
          <CardBody>
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Info className="h-4 w-4 shrink-0" /> Non ci sono ancora documenti: apri una cartella qui sopra per caricare il primo.
            </p>
          </CardBody>
        ) : (
          <PortalDocumentList documents={recenti} currentUserId={user.id} folderNames={nomi} />
        )}
      </Card>
    </div>
  );
}
