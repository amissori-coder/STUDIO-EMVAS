import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { ClientForm } from "@/modules/clienti/ClientForm";
import { updateClientAction } from "@/modules/clienti/actions";
import { canChangeReferente } from "@/modules/clienti/permessi";
import { getClientOrNotFound, getStaffUsers } from "@/modules/clienti/queries";
import { clientToFormValues } from "@/modules/clienti/validation";

export async function generateMetadata(props: PageProps<"/clienti/[id]/modifica">): Promise<Metadata> {
  const { id } = await props.params;
  const client = await getClientOrNotFound(id);
  return { title: `Modifica · ${client.denominazione}` };
}

export default async function ModificaClientePage(props: PageProps<"/clienti/[id]/modifica">) {
  const user = await requireStaff();
  const { id } = await props.params;
  const client = await getClientOrNotFound(id);
  // Include anche il referente attuale se è stato disattivato, così non viene azzerato al salvataggio
  const staff = await getStaffUsers(client.referenteId);
  const action = updateClientAction.bind(null, client.id);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={`Modifica: ${client.denominazione}`} backHref={`/clienti/${client.id}`} backLabel="Scheda cliente" />
      <ClientForm
        action={action}
        staff={staff}
        mode="edit"
        canToggleActive={user.ruolo === "ADMIN"}
        canChangeReferente={canChangeReferente(user, client)}
        cancelHref={`/clienti/${client.id}`}
        initial={clientToFormValues(client)}
      />
    </div>
  );
}
