import type { CurrentUser } from "@/lib/auth/guards";
import { getMaxUploadBytes } from "@/lib/storage";
import { DocumentsManager } from "./DocumentsManager";
import { getClientDocuments, getFolderList } from "./service";

const LIMITE_DOCUMENTI = 500;

/**
 * Tab "Documenti" nella scheda cliente (lato studio): carica cartelle e documenti (fino a 500)
 * e li passa al gestore client-side che gestisce selezione cartella, upload e azioni.
 */
export async function ClientDocumentsTab({ clientId, user }: { clientId: string; user: CurrentUser }) {
  const [folders, documents] = await Promise.all([getFolderList(clientId), getClientDocuments(clientId, { limit: LIMITE_DOCUMENTI })]);
  return (
    <DocumentsManager
      clientId={clientId}
      currentUserId={user.id}
      folders={folders}
      documents={documents}
      maxBytes={getMaxUploadBytes()}
      truncated={documents.length >= LIMITE_DOCUMENTI}
    />
  );
}
