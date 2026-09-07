"use client";
import { useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { AlertTriangle, Camera, CheckCircle2, CloudUpload, FileText, FolderOpen, Trash2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Input";
import { cn, formatBytes } from "@/lib/utils";
import { hasBlockedExtension, MAX_FILES_PER_UPLOAD, UPLOAD_ACCEPT, type DocumentDto, type UploadResponse } from "./shared";

export interface UploadDropzoneProps {
  clientId: string;
  /** cartella di destinazione (null/undefined = senza cartella, consentito solo allo staff) */
  folderId?: string | null;
  /** chiamato al termine di un caricamento riuscito */
  onDone?: (documenti: DocumentDto[]) => void;
  /** dimensione massima per file in byte (default 25 MB) */
  maxBytes?: number;
  /** mostra il pulsante "Scatta una foto" (input con capture, utile da telefono) */
  allowCamera?: boolean;
  /** mostra il campo nota (una per caricamento) */
  showNote?: boolean;
  notePlaceholder?: string;
  /** variante compatta (meno spazio verticale) */
  compact?: boolean;
  /** disabilita il caricamento mostrando un messaggio */
  disabledMessage?: string | null;
  className?: string;
}

/** "partial": alcuni file sono stati salvati, altri no (restano in elenco per un nuovo tentativo). */
type Status = "idle" | "uploading" | "done" | "partial" | "error";

function sameFile(a: File, b: File) {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

const DEFAULT_MAX = 25 * 1024 * 1024;

function uploadWithProgress(body: FormData, onProgress: (pct: number) => void) {
  return new Promise<{ status: number; json: UploadResponse }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/documenti/upload");
    xhr.responseType = "json";
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onerror = () => reject(new Error("Connessione interrotta durante il caricamento."));
    xhr.onload = () => {
      let json: UploadResponse = {};
      if (xhr.response && typeof xhr.response === "object") json = xhr.response as UploadResponse;
      else if (typeof xhr.responseText === "string" && xhr.responseText) {
        try {
          json = JSON.parse(xhr.responseText) as UploadResponse;
        } catch {
          json = {};
        }
      }
      resolve({ status: xhr.status, json });
    };
    xhr.send(body);
  });
}

/**
 * Area di caricamento riutilizzabile: selezione multipla, trascinamento (desktop), fotocamera (mobile),
 * nota facoltativa, avanzamento. Invia una POST multipart a /api/documenti/upload.
 */
export function UploadDropzone({
  clientId,
  folderId,
  onDone,
  maxBytes = DEFAULT_MAX,
  allowCamera = true,
  showNote = true,
  notePlaceholder = "Nota per lo studio (facoltativa), es. «Fatture di agosto»",
  compact = false,
  disabledMessage,
  className,
}: UploadDropzoneProps) {
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const disabled = !!disabledMessage;

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const errors: string[] = [];
    const accepted: File[] = [];
    for (const f of incoming) {
      if (f.size <= 0) errors.push(`"${f.name}" è vuoto.`);
      else if (f.size > maxBytes) errors.push(`"${f.name}" supera ${formatBytes(maxBytes)}.`);
      else if (hasBlockedExtension(f.name)) errors.push(`"${f.name}": tipo di file non consentito.`);
      else accepted.push(f);
    }
    // Calcolato sullo stato corrente, fuori dall'updater (che deve restare puro): gli handler non sono mai
    // concorrenti tra loro, quindi `files` è aggiornato.
    const merged = [...files];
    for (const f of accepted) {
      if (!merged.some((m) => sameFile(m, f))) merged.push(f);
    }
    if (merged.length > MAX_FILES_PER_UPLOAD) errors.push(`Puoi caricare al massimo ${MAX_FILES_PER_UPLOAD} file per volta.`);
    setFiles(merged.slice(0, MAX_FILES_PER_UPLOAD));
    if (errors.length) {
      setStatus("error");
      setMessage(errors.join(" "));
    } else if (status !== "uploading") {
      setStatus("idle");
      setMessage(null);
    }
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    addFiles(e.target.files);
    e.target.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    addFiles(e.dataTransfer.files);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function upload() {
    if (files.length === 0 || status === "uploading") return;
    setStatus("uploading");
    setProgress(0);
    setMessage(null);
    const body = new FormData();
    body.set("clientId", clientId);
    if (folderId) body.set("folderId", folderId);
    if (note.trim()) body.set("note", note.trim());
    for (const f of files) body.append("files", f, f.name);
    try {
      const { status: httpStatus, json } = await uploadWithProgress(body, setProgress);
      if (httpStatus >= 200 && httpStatus < 300 && json.ok && json.documenti) {
        const n = json.documenti.length;
        const falliti = json.falliti ?? [];
        if (falliti.length > 0) {
          // Caricamento parziale: restano in elenco solo i file non salvati, per riprovare.
          setStatus("partial");
          setMessage(`${n === 1 ? "1 documento caricato" : `${n} documenti caricati`}, ma non è stato possibile salvare: ${falliti.join(", ")}. Riprova con «Carica».`);
          setFiles((prev) => prev.filter((f) => falliti.includes(f.name)));
        } else {
          setStatus("done");
          setMessage(n === 1 ? "Documento caricato correttamente." : `${n} documenti caricati correttamente.`);
          setFiles([]);
          setNote("");
        }
        onDone?.(json.documenti);
      } else {
        setStatus("error");
        setMessage(json.error ?? (httpStatus === 413 ? "File troppo grande." : "Caricamento non riuscito. Riprova."));
      }
    } catch (e) {
      setStatus("error");
      setMessage((e as Error).message || "Caricamento non riuscito. Riprova.");
    }
  }

  const total = files.reduce((s, f) => s + f.size, 0);

  return (
    <div className={cn("space-y-3", className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "rounded-xl border-2 border-dashed text-center transition-colors",
          compact ? "px-4 py-4" : "px-4 py-6 sm:py-8",
          disabled ? "border-slate-200 bg-slate-50" : dragOver ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50/60 hover:border-blue-400",
        )}
      >
        <input ref={fileInput} id={inputId} type="file" multiple accept={UPLOAD_ACCEPT} className="sr-only" onChange={onInputChange} disabled={disabled} />
        {allowCamera && <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="sr-only" onChange={onInputChange} disabled={disabled} aria-label="Scatta una foto" />}
        {disabled ? (
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <FolderOpen className="h-8 w-8 text-slate-400" />
            <p className="text-sm">{disabledMessage}</p>
          </div>
        ) : (
          <>
            <CloudUpload className={cn("mx-auto text-blue-600", compact ? "h-7 w-7" : "h-10 w-10")} />
            <p className={cn("font-medium text-slate-800", compact ? "mt-1 text-sm" : "mt-2 text-base")}>
              {compact ? "Aggiungi documenti" : "Carica i tuoi documenti"}
            </p>
            <p className="mt-1 hidden text-xs text-slate-500 sm:block">Trascina qui i file oppure usa i pulsanti. PDF, immagini, Office, XML, ZIP, P7M fino a {formatBytes(maxBytes)} ciascuno.</p>
            <p className="mt-1 text-xs text-slate-500 sm:hidden">PDF, foto, Office, XML, ZIP fino a {formatBytes(maxBytes)} ciascuno.</p>
            <div className="mt-3 flex flex-col justify-center gap-2 sm:flex-row">
              <Button type="button" variant="primary" size="lg" onClick={() => fileInput.current?.click()}>
                <FileText className="h-5 w-5" /> Scegli file
              </Button>
              {allowCamera && (
                <Button type="button" variant="outline" size="lg" className="sm:hidden" onClick={() => cameraInput.current?.click()}>
                  <Camera className="h-5 w-5" /> Scatta una foto
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {files.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100">
            {files.map((f, i) => (
              <li key={`${f.name}-${f.size}-${f.lastModified}`} className="flex items-center gap-3 px-3 py-2">
                <FileText className="h-5 w-5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800" title={f.name}>
                    {f.name}
                  </p>
                  <p className="text-xs text-slate-500">{formatBytes(f.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  disabled={status === "uploading"}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-red-600 disabled:opacity-50"
                  aria-label={`Rimuovi ${f.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="space-y-3 border-t border-slate-100 p-3">
            {showNote && (
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                placeholder={notePlaceholder}
                className="min-h-[64px]"
                disabled={status === "uploading"}
                aria-label="Nota"
              />
            )}
            {status === "uploading" && (
              <div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-blue-600 transition-[width]" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-500">Caricamento in corso… {progress}%</p>
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                {files.length} {files.length === 1 ? "file" : "file"} · {formatBytes(total)}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="md" onClick={() => setFiles([])} disabled={status === "uploading"}>
                  <Trash2 className="h-4 w-4" /> Svuota
                </Button>
                <Button type="button" variant="primary" size="md" onClick={upload} disabled={status === "uploading"} className="flex-1 sm:flex-none">
                  {status === "uploading" ? <Spinner className="h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}
                  {status === "uploading" ? "Caricamento…" : files.length === 1 ? "Carica il file" : `Carica ${files.length} file`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {message && status === "done" && (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" /> {message}
        </div>
      )}
      {message && status === "partial" && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          <AlertTriangle className="h-5 w-5 shrink-0" /> {message}
        </div>
      )}
      {message && status === "error" && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <X className="h-5 w-5 shrink-0" /> {message}
        </div>
      )}
    </div>
  );
}
