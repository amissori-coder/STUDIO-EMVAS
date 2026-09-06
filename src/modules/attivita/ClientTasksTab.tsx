import type { CurrentUser } from "@/lib/auth/guards";
import { EmptyState } from "@/components/ui/EmptyState";

/** Tab "Attività" nella scheda cliente. Sostituito dal modulo attività. */
export async function ClientTasksTab({ clientId, user }: { clientId: string; user: CurrentUser }) {
  void clientId; void user;
  return <EmptyState title="Attività del cliente" description="In costruzione." />;
}
