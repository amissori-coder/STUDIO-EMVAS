"use client";
import { useActionState } from "react";
import { FileDown, FileText, CheckCircle2 } from "lucide-react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Select } from "@/components/ui/Input";
import { formatBytes } from "@/lib/utils";
import { saveAttachmentAction, type ActionResult } from "./actions";

export interface AttachmentInfo {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

export function AttachmentSaveForm({
  emailId,
  attachment,
  folders,
  defaultFolderId,
  enabled,
  alreadySaved,
}: {
  emailId: string;
  attachment: AttachmentInfo;
  folders: { id: string; nome: string }[];
  defaultFolderId: string | null;
  enabled: boolean;
  alreadySaved: boolean;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(saveAttachmentAction, {});
  const saved = alreadySaved || !!state.ok;

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        <FileText className="h-5 w-5 shrink-0 text-slate-400" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800" title={attachment.filename}>
            {attachment.filename}
          </p>
          <p className="text-xs text-slate-500">
            {formatBytes(attachment.size)} · {attachment.mimeType}
            {saved && (
              <span className="ml-2 inline-flex items-center gap-1 text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> salvato nei documenti
              </span>
            )}
          </p>
          {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
        </div>
      </div>
      {enabled ? (
        <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input type="hidden" name="emailId" value={emailId} />
          <input type="hidden" name="attachmentId" value={attachment.attachmentId} />
          <Select name="folderId" defaultValue={defaultFolderId ?? ""} aria-label="Cartella di destinazione" className="sm:w-48">
            {folders.length === 0 && <option value="">(nessuna cartella)</option>}
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Select>
          <SubmitButton variant={saved ? "outline" : "secondary"} size="md" pendingText="Salvataggio…" className="whitespace-nowrap">
            <FileDown className="h-4 w-4" /> {saved ? "Salva di nuovo" : "Salva tra i documenti"}
          </SubmitButton>
        </form>
      ) : (
        <p className="text-xs text-slate-500 sm:text-right">Associa l&apos;email a un cliente per salvare l&apos;allegato.</p>
      )}
    </li>
  );
}
