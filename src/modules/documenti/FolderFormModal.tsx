"use client";
import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { createFolderAction, updateFolderAction, type DocActionResult } from "./actions";
import type { FolderDto } from "./shared";

/** Opzioni per il select della cartella padre: tutte le cartelle tranne quella in modifica e le sue discendenti. */
function parentOptions(folders: FolderDto[], excludeId?: string) {
  const excluded = new Set<string>();
  if (excludeId) {
    excluded.add(excludeId);
    let changed = true;
    while (changed) {
      changed = false;
      for (const f of folders) {
        if (f.parentId && excluded.has(f.parentId) && !excluded.has(f.id)) {
          excluded.add(f.id);
          changed = true;
        }
      }
    }
  }
  const byParent = new Map<string | null, FolderDto[]>();
  for (const f of folders) {
    if (excluded.has(f.id)) continue;
    const list = byParent.get(f.parentId) ?? [];
    list.push(f);
    byParent.set(f.parentId, list);
  }
  const out: { id: string; label: string }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const f of byParent.get(parentId) ?? []) {
      out.push({ id: f.id, label: `${"— ".repeat(depth)}${f.nome}` });
      walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function FolderFormModal({
  open,
  onClose,
  clientId,
  folders,
  folder,
  defaultParentId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
  folders: FolderDto[];
  /** cartella da modificare (assente = nuova cartella) */
  folder?: FolderDto | null;
  defaultParentId?: string | null;
  onSaved?: (id: string) => void;
}) {
  const editing = !!folder;
  const [state, formAction] = useActionState<DocActionResult, FormData>(async (prev, fd) => {
    const r = editing ? await updateFolderAction(prev, fd) : await createFolderAction(prev, fd);
    if (r.ok) {
      onSaved?.(r.id ?? folder?.id ?? "");
      onClose();
    }
    return r;
  }, {});
  const [visibile, setVisibile] = useState(folder?.visibileCliente ?? true);
  const options = parentOptions(folders, folder?.id);

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Modifica cartella" : "Nuova cartella"} size="md">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="clientId" value={clientId} />
        {folder && <input type="hidden" name="folderId" value={folder.id} />}
        {state.error && <Alert kind="error">{state.error}</Alert>}
        <Field label="Nome *" htmlFor="folder-nome">
          <Input id="folder-nome" name="nome" required maxLength={100} defaultValue={folder?.nome ?? ""} placeholder="Es. Fatture di vendita 2026" autoFocus />
        </Field>
        <Field label="Descrizione" htmlFor="folder-descrizione" hint="Mostrata al cliente nel portale come indicazione su cosa caricare.">
          <Textarea id="folder-descrizione" name="descrizione" maxLength={300} defaultValue={folder?.descrizione ?? ""} className="min-h-[72px]" placeholder="Es. Carica qui le fatture emesse ogni mese" />
        </Field>
        <Field label="Cartella principale" htmlFor="folder-parent" hint="Lascia vuoto per creare una cartella di primo livello.">
          <Select id="folder-parent" name="parentId" defaultValue={folder?.parentId ?? defaultParentId ?? ""}>
            <option value="">— Nessuna (primo livello) —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <Checkbox name="visibileCliente" label="Visibile al cliente nel portale" checked={visibile} onChange={(e) => setVisibile(e.target.checked)} />
          <Checkbox name="clientePuoCaricare" label="Il cliente può caricare documenti in questa cartella" defaultChecked={folder?.clientePuoCaricare ?? true} disabled={!visibile} />
          {!visibile && <p className="text-xs text-slate-500">Una cartella nascosta è riservata allo studio: il cliente non la vede e non può caricarvi file.</p>}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <SubmitButton pendingText="Salvataggio…">{editing ? "Salva modifiche" : "Crea cartella"}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
