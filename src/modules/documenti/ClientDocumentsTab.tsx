import type { CurrentUser } from "@/lib/auth/guards";
import { EmptyState } from "@/components/ui/EmptyState";

/** Tab "Documenti" nella scheda cliente (lato studio). Sostituito dal modulo documenti/portale. */
export async function ClientDocumentsTab({ clientId, user }: { clientId: string; user: CurrentUser }) {
  void clientId; void user;
  return <EmptyState title="Documenti del cliente" description="In costruzione." />;
}
