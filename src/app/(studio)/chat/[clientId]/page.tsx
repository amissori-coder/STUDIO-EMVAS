import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { requireStaff } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { ChatLayout } from "@/modules/chat/ChatLayout";
import { ClientChatPanel } from "@/modules/chat/ClientChatPanel";
import { markChatRead } from "@/modules/chat/service";

export async function generateMetadata(props: PageProps<"/chat/[clientId]">): Promise<Metadata> {
  const { clientId } = await props.params;
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { denominazione: true } });
  return { title: client ? `Chat · ${client.denominazione}` : "Chat" };
}

export default async function ChatClientPage(props: PageProps<"/chat/[clientId]">) {
  const user = await requireStaff();
  const { clientId } = await props.params;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, denominazione: true, attivo: true, referente: { select: { nome: true, colore: true } } },
  });
  if (!client) notFound();
  // Segna come letta prima di calcolare i non letti dell'elenco a sinistra
  await markChatRead(user.id, client.id);

  return (
    <>
      <div className="mb-4 hidden lg:block">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Chat</h1>
        <p className="mt-1 text-sm text-slate-500">Conversazioni interne dello studio, una per cliente</p>
      </div>
      <ChatLayout user={user} activeId={client.id}>
        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-2.5 sm:px-4">
            <Link href="/chat" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Torna all'elenco">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold text-slate-900">{client.denominazione}</h2>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                {client.referente ? (
                  <>
                    <Avatar nome={client.referente.nome} colore={client.referente.colore} size="xs" className="h-4 w-4 text-[8px]" />
                    Referente: {client.referente.nome}
                  </>
                ) : (
                  "Nessun referente"
                )}
                {!client.attivo && <span className="text-slate-400">· cliente archiviato</span>}
              </p>
            </div>
            <Link
              href={`/clienti/${client.id}`}
              className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              <ExternalLink className="h-4 w-4" /> <span className="hidden sm:inline">Scheda cliente</span>
            </Link>
          </div>
          <div className="p-2 sm:p-3">
            <ClientChatPanel clientId={client.id} user={user} heightClass="h-[calc(100dvh-15rem)] lg:h-[calc(100dvh-14.5rem)]" />
          </div>
        </Card>
      </ChatLayout>
    </>
  );
}
