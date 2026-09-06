import { Download, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { formatBytes, formatDateTime } from "@/lib/utils";
import { FileIcon } from "@/modules/documenti/FileIcon";
import type { DocumentDto } from "@/modules/documenti/shared";
import { deletePortalDocumentAction } from "./actions";

/** Elenco documenti nel portale: nome, dimensione, data, chi l'ha caricato; eliminazione dei propri caricamenti. */
export function PortalDocumentList({
  documents,
  currentUserId,
  folderId,
  folderNames,
}: {
  documents: DocumentDto[];
  currentUserId: string;
  /** se indicato, abilita l'eliminazione dei propri documenti (form nella pagina cartella) */
  folderId?: string;
  /** nomi delle cartelle per mostrare la cartella di ciascun documento (home) */
  folderNames?: Map<string, string>;
}) {
  return (
    <ul className="divide-y divide-slate-100">
      {documents.map((d) => {
        const mio = d.daCliente && d.uploadedBy?.id === currentUserId;
        const cartella = folderNames && d.folderId ? folderNames.get(d.folderId) : undefined;
        return (
          <li key={d.id} className="flex items-center gap-3 px-4 py-3">
            <FileIcon nome={d.nome} mimeType={d.mimeType} className="h-6 w-6" />
            <div className="min-w-0 flex-1">
              <a href={`/api/documenti/${d.id}`} target="_blank" rel="noopener" className="block break-words text-sm font-medium text-slate-900 hover:text-blue-700" title={d.nome}>
                {d.nome}
              </a>
              <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-slate-500">
                <span>{formatBytes(d.size)}</span>
                <span>· {formatDateTime(d.createdAt)}</span>
                <span>· {mio ? "caricato da te" : d.daCliente ? "caricato dalla tua azienda" : "dallo studio"}</span>
                {cartella && <span className="text-slate-400">· {cartella}</span>}
              </p>
              {d.note && <p className="mt-0.5 text-xs italic text-slate-600">{d.note}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <a
                href={`/api/documenti/${d.id}`}
                download={d.nome}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                title="Scarica"
                aria-label={`Scarica ${d.nome}`}
              >
                <Download className="h-5 w-5" />
              </a>
              {mio && folderId && (
                <form action={deletePortalDocumentAction.bind(null, folderId, d.id)}>
                  <ConfirmButton
                    variant="ghost"
                    size="icon"
                    className="text-slate-500 hover:text-red-600"
                    message={`Eliminare «${d.nome}»? Lo studio non lo vedrà più.`}
                    title="Elimina"
                    aria-label={`Elimina ${d.nome}`}
                  >
                    <Trash2 className="h-5 w-5" />
                  </ConfirmButton>
                </form>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
