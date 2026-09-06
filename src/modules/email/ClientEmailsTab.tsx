import { Inbox, Mail } from "lucide-react";
import type { CurrentUser } from "@/lib/auth/guards";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmailRow } from "./EmailRow";
import { listEmailsForClient } from "./queries";

const LIMIT = 50;

/** Tab "Email" nella scheda cliente: le email associate al cliente, dalla più recente. */
export async function ClientEmailsTab({ clientId, user }: { clientId: string; user: CurrentUser }) {
  void user;
  const emails = await listEmailsForClient(clientId, LIMIT);
  const inboxHref = `/email?vista=tutte&cliente=${encodeURIComponent(clientId)}`;

  if (emails.length === 0) {
    return (
      <EmptyState
        icon={<Inbox />}
        title="Nessuna email associata a questo cliente"
        description="Le email vengono associate automaticamente in base agli indirizzi del cliente e dei suoi contatti, oppure manualmente dalla casella email."
        action={
          <Button href="/email" variant="outline">
            <Mail className="h-4 w-4" /> Vai alla casella email
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {emails.length >= LIMIT ? `Ultime ${LIMIT} email` : `${emails.length} ${emails.length === 1 ? "email" : "email"}`} associate al cliente
        </p>
        <Button href={inboxHref} variant="outline" size="sm">
          <Mail className="h-4 w-4" /> Apri nella casella email
        </Button>
      </div>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {emails.map((e) => (
            <EmailRow key={e.id} email={e} showClient={false} />
          ))}
        </ul>
      </Card>
    </div>
  );
}
