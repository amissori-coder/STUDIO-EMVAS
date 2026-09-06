"use client";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TaskForm, type OpzioneTemplate, type TaskFormValues } from "@/modules/attivita/TaskForm";
import { aggiornaTask } from "@/modules/attivita/actions";

export function TaskEditModal({
  valori,
  clienti,
  utenti,
  templates,
  className,
}: {
  valori: TaskFormValues;
  clienti: { id: string; denominazione: string }[];
  utenti: { id: string; nome: string }[];
  templates: OpzioneTemplate[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className={className}>
        <Pencil className="h-4 w-4" /> Modifica
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Modifica attività" size="lg">
        {open && (
          <TaskForm
            action={aggiornaTask}
            valori={valori}
            clienti={clienti}
            utenti={utenti}
            templates={templates}
            submitLabel="Salva modifiche"
            onSuccess={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        )}
      </Modal>
    </>
  );
}
