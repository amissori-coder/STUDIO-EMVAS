import type { CurrentUser } from "@/lib/auth/guards";
import { EmptyState } from "@/components/ui/EmptyState";

/** Pannello chat del cliente (usato nella scheda cliente e nella pagina /chat/[clientId]). Sostituito dal modulo chat. */
export async function ClientChatPanel({ clientId, user }: { clientId: string; user: CurrentUser }) {
  void clientId; void user;
  return <EmptyState title="Chat del cliente" description="In costruzione." />;
}
