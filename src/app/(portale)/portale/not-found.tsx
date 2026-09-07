import { FolderX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

/** Pagina 404 del portale (renderizzata dentro il layout con intestazione e piè di pagina). */
export default function PortaleNotFound() {
  return (
    <EmptyState
      icon={<FolderX />}
      title="Cartella non disponibile"
      description="La cartella che cerchi non esiste, non è più visibile oppure appartiene a un'altra azienda. Torna alla pagina principale per vedere le tue cartelle."
      action={<Button href="/portale">Torna alle tue cartelle</Button>}
    />
  );
}
