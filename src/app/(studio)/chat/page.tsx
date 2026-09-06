import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { requireStaff } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChatLayout } from "@/modules/chat/ChatLayout";

export const metadata: Metadata = { title: "Chat" };

export default async function ChatPage(props: PageProps<"/chat">) {
  const user = await requireStaff();
  const sp = await props.searchParams;
  const cliente = typeof sp.cliente === "string" ? sp.cliente.trim() : "";
  if (cliente) redirect(`/chat/${encodeURIComponent(cliente)}`);

  return (
    <>
      <PageHeader title="Chat" description="Conversazioni interne dello studio, una per cliente" />
      <ChatLayout user={user}>
        <EmptyState
          icon={<MessageSquare />}
          title="Seleziona una conversazione"
          description="Scegli un cliente dall'elenco per leggere e scrivere messaggi con i colleghi. Usa @Nome per menzionare qualcuno."
          className="h-[calc(100dvh-10rem)]"
        />
      </ChatLayout>
    </>
  );
}
