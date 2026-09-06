import type { ReactNode } from "react";
import { format, isToday, isYesterday } from "date-fns";
import type { CurrentUser } from "@/lib/auth/guards";
import { formatDate, truncate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { ConversationList, type ConversationDto } from "./ConversationList";
import { listConversations } from "./service";

function timeLabel(d: Date) {
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "ieri";
  return formatDate(d, "dd/MM");
}

/**
 * Layout a due colonne della chat: elenco conversazioni a sinistra (su mobile è visibile solo
 * quando non c'è una conversazione aperta) e contenuto a destra.
 */
export async function ChatLayout({ user, activeId, children }: { user: CurrentUser; activeId?: string; children: ReactNode }) {
  const conversations = await listConversations(user.id);
  const items: ConversationDto[] = conversations.map((c) => ({
    id: c.id,
    denominazione: c.denominazione,
    attivo: c.attivo,
    preview: c.lastMessage
      ? `${c.lastMessage.authorId === user.id ? "Tu" : c.lastMessage.authorNome.split(" ")[0]}: ${truncate(c.lastMessage.testo.replace(/\s+/g, " "), 70)}`
      : null,
    timeLabel: c.lastMessage ? timeLabel(c.lastMessage.createdAt) : null,
    unread: c.unread,
  }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
      <Card className={cn("overflow-hidden lg:block lg:h-[calc(100dvh-10rem)]", activeId ? "hidden" : "block h-[calc(100dvh-13rem)]")}>
        <ConversationList items={items} activeId={activeId} />
      </Card>
      <div className={cn("min-w-0", !activeId && "hidden lg:block")}>{children}</div>
    </div>
  );
}
