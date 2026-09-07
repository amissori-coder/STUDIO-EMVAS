"use client";
import Link from "next/link";
import { Download, FolderInput, ListChecks, Mail, StickyNote, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatBytes } from "@/lib/utils";
import { FileIcon } from "./FileIcon";
import type { DocumentDto } from "./shared";

export function uploaderLabel(doc: DocumentDto, currentUserId: string) {
  if (doc.uploadedBy?.id === currentUserId) return "Tu";
  if (doc.uploadedBy) return doc.uploadedBy.nome;
  return doc.daCliente ? "Cliente" : "Studio";
}

/** Riga documento per l'area staff (con azioni). */
export function DocumentRow({
  doc,
  currentUserId,
  folderName,
  busy,
  onNote,
  onMove,
  onDelete,
}: {
  doc: DocumentDto;
  currentUserId: string;
  /** nome della cartella (mostrato quando l'elenco non è filtrato per cartella) */
  folderName?: string | null;
  busy?: boolean;
  onNote: (doc: DocumentDto) => void;
  onMove: (doc: DocumentDto) => void;
  onDelete: (doc: DocumentDto) => void;
}) {
  const actionCls = "inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50";
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-3 sm:px-5">
      <FileIcon nome={doc.nome} mimeType={doc.mimeType} className="mt-0.5 hidden sm:block" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <FileIcon nome={doc.nome} mimeType={doc.mimeType} className="mt-0.5 sm:hidden" />
          <a href={`/api/documenti/${doc.id}`} target="_blank" rel="noopener" className="min-w-0 flex-1 break-words text-sm font-medium text-slate-900 hover:text-blue-700" title={doc.nome}>
            {doc.nome}
          </a>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>{formatBytes(doc.size)}</span>
          {/* etichetta calcolata sul server: formattarla qui col fuso del browser causerebbe un hydration mismatch */}
          <time dateTime={doc.createdAt}>{doc.createdAtLabel}</time>
          <span>{doc.uploadedBy?.id === currentUserId ? "caricato da te" : `da ${uploaderLabel(doc, currentUserId)}`}</span>
          {folderName !== undefined && <span className="text-slate-400">{folderName ?? "Senza cartella"}</span>}
          {doc.daCliente && <Badge color="blue">Dal cliente</Badge>}
          {doc.email && (
            <Link href={`/email/${doc.email.id}`} className="inline-flex max-w-[16rem] items-center gap-1 text-blue-700 hover:underline" title={doc.email.subject}>
              <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{doc.email.subject || "Email"}</span>
            </Link>
          )}
          {doc.task && (
            <Link href={`/attivita/${doc.task.id}`} className="inline-flex max-w-[16rem] items-center gap-1 text-blue-700 hover:underline" title={doc.task.titolo}>
              <ListChecks className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{doc.task.titolo}</span>
            </Link>
          )}
        </div>
        {doc.note && <p className="mt-1 whitespace-pre-line text-xs italic text-slate-600">{doc.note}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-0.5 sm:-mr-2">
        <a href={`/api/documenti/${doc.id}`} download={doc.nome} className={actionCls} title="Scarica" aria-label={`Scarica ${doc.nome}`}>
          <Download className="h-4 w-4" />
        </a>
        <button type="button" className={actionCls} title={doc.note ? "Modifica nota" : "Aggiungi nota"} aria-label="Nota" onClick={() => onNote(doc)} disabled={busy}>
          <StickyNote className="h-4 w-4" />
        </button>
        <button type="button" className={actionCls} title="Sposta in un'altra cartella" aria-label="Sposta" onClick={() => onMove(doc)} disabled={busy}>
          <FolderInput className="h-4 w-4" />
        </button>
        <button type="button" className={`${actionCls} hover:text-red-600`} title="Elimina" aria-label={`Elimina ${doc.nome}`} onClick={() => onDelete(doc)} disabled={busy}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
