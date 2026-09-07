import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileText, Folder, Home, Lock, Upload } from "lucide-react";
import { requireClientUser } from "@/lib/auth/guards";
import { getMaxUploadBytes } from "@/lib/storage";
import { Alert } from "@/components/ui/Alert";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkPending } from "@/modules/portale/LinkPending";
import { PortalDocumentList } from "@/modules/portale/PortalDocumentList";
import { PortalFolderCard } from "@/modules/portale/PortalFolderCard";
import { PortalUpload } from "@/modules/portale/PortalUpload";
import { getPortalFolder, getPortalFolderDocuments, PORTAL_ERROR_MESSAGES } from "@/modules/portale/service";

export async function generateMetadata(props: PageProps<"/portale/cartelle/[id]">): Promise<Metadata> {
  const user = await requireClientUser();
  const { id } = await props.params;
  const res = await getPortalFolder(user, id);
  return { title: res ? res.folder.nome : "Cartella" };
}

export default async function PortaleCartellaPage(props: PageProps<"/portale/cartelle/[id]">) {
  const user = await requireClientUser();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const res = await getPortalFolder(user, id);
  if (!res) notFound();
  const { folder, chain, clientId } = res;
  const documents = await getPortalFolderDocuments(folder.id);
  const messaggio = sp.messaggio === "eliminato" ? "Documento eliminato." : null;
  // solo codici noti: il testo non arriva mai dalla query string
  const errore = typeof sp.errore === "string" ? (PORTAL_ERROR_MESSAGES[sp.errore] ?? null) : null;
  const parents = chain.slice(0, -1);

  return (
    <div className="space-y-5">
      <nav aria-label="Percorso" className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
        <Link href={`/portale?cliente=${encodeURIComponent(clientId)}`} className="inline-flex min-h-8 items-center gap-1 rounded-md px-1 hover:text-blue-700">
          <LinkPending className="h-4 w-4">
            <Home className="h-4 w-4" />
          </LinkPending>{" "}
          Home
        </Link>
        {parents.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-slate-300" />
            <Link href={`/portale/cartelle/${p.id}`} className="inline-flex min-h-8 items-center rounded-md px-1 hover:text-blue-700">
              {p.nome}
            </Link>
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <ChevronRight className="h-4 w-4 text-slate-300" />
          <span className="px-1 font-medium text-slate-800">{folder.nome}</span>
        </span>
      </nav>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900 sm:text-2xl">
          <Folder className="h-6 w-6 text-blue-600" /> {folder.nome}
          {!folder.clientePuoCaricare && <Lock className="h-5 w-5 text-slate-400" aria-label="Solo consultazione" />}
        </h1>
        {folder.descrizione && <p className="mt-1 text-sm text-slate-600">{folder.descrizione}</p>}
      </div>

      {messaggio && <Alert kind="success">{messaggio}</Alert>}
      {errore && <Alert kind="error">{errore}</Alert>}

      {folder.children.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Sottocartelle</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {folder.children.map((c) => (
              <PortalFolderCard key={c.id} folder={c} />
            ))}
          </div>
        </section>
      )}

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-600" /> Carica documenti
            </span>
          }
          description={folder.clientePuoCaricare ? "Puoi caricare più file insieme. Aggiungi una nota se vuoi dare indicazioni allo studio." : undefined}
        />
        <CardBody>
          {folder.clientePuoCaricare ? (
            <PortalUpload clientId={clientId} folderId={folder.id} maxBytes={getMaxUploadBytes()} />
          ) : (
            <Alert kind="warning" title="Cartella in sola consultazione">
              In questa cartella lo studio mette a tua disposizione i documenti: non è possibile caricare file. Se devi inviare qualcosa, usa un&apos;altra cartella o contatta lo studio.
            </Alert>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-400" /> Documenti <span className="font-normal text-slate-500">({documents.length})</span>
            </span>
          }
        />
        {documents.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={<FileText />}
              title="Questa cartella è vuota"
              description={folder.clientePuoCaricare ? "Carica il primo documento con il pulsante qui sopra." : "Lo studio non ha ancora pubblicato documenti in questa cartella."}
            />
          </CardBody>
        ) : (
          <PortalDocumentList documents={documents} currentUserId={user.id} folderId={folder.id} />
        )}
      </Card>
    </div>
  );
}
