"use client";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Eye, EyeOff, FileText, Folder, FolderOpen, FolderPlus, Inbox, Layers, Lock, Pencil, Trash2, Upload } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { deleteDocumentAction, deleteFolderAction, moveDocumentAction, updateDocumentNoteAction } from "./actions";
import { DocumentRow } from "./DocumentRow";
import { FolderFormModal } from "./FolderFormModal";
import { UploadDropzone } from "./UploadDropzone";
import { buildFolderTree, countDeep, type DocumentDto, type FolderDto, type FolderNode } from "./shared";

type Selection = "all" | "none" | string;
type ModalState =
  | { type: "newFolder"; parentId: string | null }
  | { type: "editFolder"; folder: FolderDto }
  | { type: "note"; doc: DocumentDto }
  | { type: "move"; doc: DocumentDto }
  | null;

function flattenTree(nodes: FolderNode[], depth = 0): { node: FolderNode; depth: number }[] {
  return nodes.flatMap((n) => [{ node: n, depth }, ...flattenTree(n.children, depth + 1)]);
}

export function DocumentsManager({
  clientId,
  currentUserId,
  folders,
  documents,
  maxBytes,
  truncated,
}: {
  clientId: string;
  currentUserId: string;
  folders: FolderDto[];
  documents: DocumentDto[];
  maxBytes: number;
  /** true se l'elenco documenti è stato limitato */
  truncated: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Selection>("all");
  const [modal, setModal] = useState<ModalState>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploadOpen, setUploadOpen] = useState(() => documents.length === 0);

  const tree = useMemo(() => buildFolderTree(folders), [folders]);
  const flat = useMemo(() => flattenTree(tree), [tree]);
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const nodeById = useMemo(() => new Map(flat.map((x) => [x.node.id, x.node])), [flat]);

  const selectedFolder = selected !== "all" && selected !== "none" ? (folderById.get(selected) ?? null) : null;
  const selectedNode = selectedFolder ? nodeById.get(selectedFolder.id) : undefined;
  // se la cartella selezionata è stata eliminata, torna a "tutti"
  const effective: Selection = selected === "all" || selected === "none" || selectedFolder ? selected : "all";

  const senzaCartella = useMemo(() => documents.filter((d) => !d.folderId).length, [documents]);
  const visibleDocs = useMemo(() => {
    if (effective === "all") return documents;
    if (effective === "none") return documents.filter((d) => !d.folderId);
    return documents.filter((d) => d.folderId === effective);
  }, [documents, effective]);

  const breadcrumb = useMemo(() => {
    const chain: FolderDto[] = [];
    let cur = selectedFolder;
    for (let i = 0; cur && i < 20; i++) {
      chain.unshift(cur);
      cur = cur.parentId ? (folderById.get(cur.parentId) ?? null) : null;
    }
    return chain;
  }, [selectedFolder, folderById]);

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
    });
  }

  function handleDeleteFolder(folder: FolderDto) {
    if (!window.confirm(`Eliminare la cartella «${folder.nome}»?`)) return;
    setError(null);
    startTransition(async () => {
      let r = await deleteFolderAction(folder.id, false);
      if (r.needsConfirm) {
        const ok = window.confirm(
          `La cartella «${folder.nome}» (con le eventuali sottocartelle) contiene ${r.count} document${r.count === 1 ? "o" : "i"}. Verranno spostati in «Senza cartella» e non andranno persi. Continuare?`,
        );
        if (!ok) return;
        r = await deleteFolderAction(folder.id, true);
      }
      if (r.error) setError(r.error);
      else if (effective === folder.id) setSelected(folder.parentId ?? "all");
    });
  }

  function handleDeleteDoc(doc: DocumentDto) {
    if (!window.confirm(`Eliminare definitivamente «${doc.nome}»?`)) return;
    run(() => deleteDocumentAction(doc.id));
  }

  const title = effective === "all" ? "Tutti i documenti" : effective === "none" ? "Senza cartella" : selectedFolder!.nome;

  const selectorItem = (key: Selection, label: string, icon: ReactNode, count: number, depth = 0, extra?: ReactNode) => (
    <button
      key={key}
      type="button"
      onClick={() => setSelected(key)}
      className={cn(
        "flex w-full min-h-10 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
        effective === key ? "bg-blue-50 font-medium text-blue-800" : "text-slate-700 hover:bg-slate-100",
      )}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
    >
      <span className="shrink-0 text-slate-400 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {extra}
      <span className="shrink-0 rounded-full bg-slate-100 px-1.5 text-xs text-slate-500">{count}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      {error && (
        <Alert kind="error" className="mb-1">
          {error}
        </Alert>
      )}
      <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        {/* Elenco cartelle: select su mobile, albero su desktop */}
        <Card className="lg:sticky lg:top-20">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Cartelle</h3>
            <Button size="sm" variant="outline" onClick={() => setModal({ type: "newFolder", parentId: null })}>
              <FolderPlus className="h-4 w-4" /> Nuova
            </Button>
          </div>
          <div className="p-3 lg:hidden">
            <Select value={effective} onChange={(e) => setSelected(e.target.value)} aria-label="Cartella">
              <option value="all">Tutti i documenti ({documents.length})</option>
              <option value="none">Senza cartella ({senzaCartella})</option>
              {flat.map(({ node, depth }) => (
                <option key={node.id} value={node.id}>
                  {"— ".repeat(depth)}
                  {node.nome} ({node.count})
                </option>
              ))}
            </Select>
          </div>
          <nav className="hidden max-h-[70vh] space-y-0.5 overflow-y-auto p-2 lg:block" aria-label="Cartelle">
            {selectorItem("all", "Tutti i documenti", <Layers />, documents.length)}
            {selectorItem("none", "Senza cartella", <Inbox />, senzaCartella)}
            <div className="my-1 border-t border-slate-100" />
            {flat.length === 0 && <p className="px-2 py-2 text-xs text-slate-500">Nessuna cartella. Creane una con «Nuova».</p>}
            {flat.map(({ node, depth }) =>
              selectorItem(
                node.id,
                node.nome,
                effective === node.id ? <FolderOpen /> : <Folder />,
                node.count,
                depth,
                !node.visibileCliente ? <EyeOff className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-label="Nascosta al cliente" /> : !node.clientePuoCaricare ? <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-label="Solo lettura per il cliente" /> : null,
              ),
            )}
          </nav>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card>
            <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
              {breadcrumb.length > 1 && (
                <ol className="mb-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                  {breadcrumb.slice(0, -1).map((f) => (
                    <li key={f.id} className="flex items-center gap-1">
                      <button type="button" onClick={() => setSelected(f.id)} className="hover:text-blue-700 hover:underline">
                        {f.nome}
                      </button>
                      <ChevronRight className="h-3 w-3" />
                    </li>
                  ))}
                </ol>
              )}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900">
                    {title}
                    {selectedFolder && (
                      <>
                        {selectedFolder.visibileCliente ? (
                          <Badge color="green">
                            <Eye className="h-3 w-3" /> Visibile al cliente
                          </Badge>
                        ) : (
                          <Badge color="slate">
                            <EyeOff className="h-3 w-3" /> Nascosta al cliente
                          </Badge>
                        )}
                        {selectedFolder.visibileCliente && !selectedFolder.clientePuoCaricare && (
                          <Badge color="yellow">
                            <Lock className="h-3 w-3" /> Il cliente non può caricare
                          </Badge>
                        )}
                      </>
                    )}
                  </h3>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {selectedFolder?.descrizione ??
                      (effective === "all"
                        ? `${documents.length} document${documents.length === 1 ? "o" : "i"} in totale`
                        : effective === "none"
                          ? "Documenti non assegnati ad alcuna cartella (es. allegati email salvati senza cartella)."
                          : `${selectedNode ? countDeep(selectedNode) : 0} documenti incluse le sottocartelle`)}
                  </p>
                </div>
                {selectedFolder && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setModal({ type: "newFolder", parentId: selectedFolder.id })}>
                      <FolderPlus className="h-4 w-4" /> Sottocartella
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setModal({ type: "editFolder", folder: selectedFolder })}>
                      <Pencil className="h-4 w-4" /> Modifica
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => handleDeleteFolder(selectedFolder)} disabled={pending}>
                      <Trash2 className="h-4 w-4" /> Elimina
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {selectedNode && selectedNode.children.length > 0 && (
              <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
                {selectedNode.children.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelected(c.id)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                  >
                    <Folder className="h-4 w-4 text-slate-400" /> {c.nome}
                    <span className="rounded-full bg-white px-1.5 text-xs text-slate-500 ring-1 ring-slate-200">{countDeep(c)}</span>
                  </button>
                ))}
              </div>
            )}

            <CardBody>
              <details className="group" open={uploadOpen} onToggle={(e) => setUploadOpen(e.currentTarget.open)}>
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-slate-700">
                  <Upload className="h-4 w-4 text-blue-600" />
                  Carica documenti {effective === "all" ? "(senza cartella)" : effective === "none" ? "" : `in «${title}»`}
                  <span className="ml-auto text-xs text-slate-400 group-open:hidden">mostra</span>
                  <span className="ml-auto hidden text-xs text-slate-400 group-open:inline">nascondi</span>
                </summary>
                <div className="mt-3">
                  <UploadDropzone
                    key={effective}
                    clientId={clientId}
                    folderId={selectedFolder?.id ?? null}
                    maxBytes={maxBytes}
                    allowCamera={false}
                    notePlaceholder="Nota (facoltativa), es. «Ricevuto via PEC il 5/9»"
                    compact
                    onDone={() => router.refresh()}
                  />
                </div>
              </details>
            </CardBody>
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
              <h3 className="text-sm font-semibold text-slate-900">
                Documenti <span className="font-normal text-slate-500">({visibleDocs.length})</span>
              </h3>
              {truncated && <span className="text-xs text-slate-500">Mostrati i 500 più recenti</span>}
            </div>
            {visibleDocs.length === 0 ? (
              <CardBody>
                <EmptyState
                  icon={<FileText />}
                  title={effective === "all" ? "Nessun documento per questo cliente" : "Nessun documento in questa cartella"}
                  description="Carica i file con l'area qui sopra: puoi trascinarli oppure selezionarli dal computer. I documenti caricati dal cliente dal portale compariranno qui."
                />
              </CardBody>
            ) : (
              <ul className={cn("divide-y divide-slate-100", pending && "opacity-60")}>
                {visibleDocs.map((d) => (
                  <DocumentRow
                    key={d.id}
                    doc={d}
                    currentUserId={currentUserId}
                    folderName={effective === "all" ? (d.folderId ? (folderById.get(d.folderId)?.nome ?? null) : null) : undefined}
                    busy={pending}
                    onNote={(doc) => setModal({ type: "note", doc })}
                    onMove={(doc) => setModal({ type: "move", doc })}
                    onDelete={handleDeleteDoc}
                  />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {modal?.type === "newFolder" && (
        <FolderFormModal open onClose={() => setModal(null)} clientId={clientId} folders={folders} defaultParentId={modal.parentId} onSaved={(id) => id && setSelected(id)} />
      )}
      {modal?.type === "editFolder" && <FolderFormModal open onClose={() => setModal(null)} clientId={clientId} folders={folders} folder={modal.folder} />}
      {modal?.type === "note" && (
        <NoteModal
          doc={modal.doc}
          onClose={() => setModal(null)}
          onSave={(note) => {
            setModal(null);
            run(() => updateDocumentNoteAction(modal.doc.id, note));
          }}
        />
      )}
      {modal?.type === "move" && (
        <MoveModal
          doc={modal.doc}
          flat={flat}
          onClose={() => setModal(null)}
          onMove={(folderId) => {
            setModal(null);
            run(() => moveDocumentAction(modal.doc.id, folderId));
          }}
        />
      )}
    </div>
  );
}

function NoteModal({ doc, onClose, onSave }: { doc: DocumentDto; onClose: () => void; onSave: (note: string) => void }) {
  const [note, setNote] = useState(doc.note ?? "");
  return (
    <Modal
      open
      onClose={onClose}
      title="Nota del documento"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={() => onSave(note)}>Salva</Button>
        </>
      }
    >
      <p className="mb-2 truncate text-sm text-slate-600" title={doc.nome}>
        {doc.nome}
      </p>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Es. Da registrare entro il 16" autoFocus aria-label="Nota" />
    </Modal>
  );
}

function MoveModal({
  doc,
  flat,
  onClose,
  onMove,
}: {
  doc: DocumentDto;
  flat: { node: FolderNode; depth: number }[];
  onClose: () => void;
  onMove: (folderId: string | null) => void;
}) {
  const [target, setTarget] = useState<string>(doc.folderId ?? "");
  return (
    <Modal
      open
      onClose={onClose}
      title="Sposta documento"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={() => onMove(target || null)} disabled={(doc.folderId ?? "") === target}>
            Sposta
          </Button>
        </>
      }
    >
      <p className="mb-2 truncate text-sm text-slate-600" title={doc.nome}>
        {doc.nome}
      </p>
      <Select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Cartella di destinazione">
        <option value="">— Senza cartella —</option>
        {flat.map(({ node, depth }) => (
          <option key={node.id} value={node.id}>
            {"— ".repeat(depth)}
            {node.nome}
          </option>
        ))}
      </Select>
    </Modal>
  );
}
