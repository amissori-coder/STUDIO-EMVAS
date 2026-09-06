import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { ClientTasksTab } from "@/modules/attivita/ClientTasksTab";

export const metadata: Metadata = { title: "Attività del cliente" };

/** Vista a pagina intera delle attività e della pianificazione di un cliente (stesso contenuto della tab "Attività" della scheda). */
export default async function AttivitaClientePage(props: PageProps<"/attivita/cliente/[id]">) {
  const user = await requireStaff();
  const { id } = await props.params;
  const client = await prisma.client.findUnique({ where: { id }, select: { id: true, denominazione: true, attivo: true } });
  if (!client) notFound();

  return (
    <>
      <PageHeader
        title={client.denominazione}
        description={`Attività e pianificazione adempimenti${client.attivo ? "" : " · cliente archiviato"}`}
        backHref="/attivita"
        backLabel="Attività"
        actions={
          <Button href={`/clienti/${client.id}`} variant="outline">
            Scheda cliente
          </Button>
        }
      />
      <ClientTasksTab clientId={client.id} user={user} />
    </>
  );
}
