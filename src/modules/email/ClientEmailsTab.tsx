import type { CurrentUser } from "@/lib/auth/guards";
import { EmptyState } from "@/components/ui/EmptyState";

/** Tab "Email" nella scheda cliente. Sostituito dal modulo email. */
export async function ClientEmailsTab({ clientId, user }: { clientId: string; user: CurrentUser }) {
  void clientId; void user;
  return <EmptyState title="Email del cliente" description="In costruzione." />;
}
