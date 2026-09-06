"use client";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { toggleArchiveEmailAction } from "./actions";

export function ArchiveButton({ emailId, archiviata }: { emailId: string; archiviata: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await toggleArchiveEmailAction(emailId);
            setError(r.error ?? null);
          })
        }
      >
        {pending ? <Spinner className="h-4 w-4" /> : archiviata ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        {archiviata ? "Ripristina" : "Archivia"}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
