import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { ClientForm } from "@/modules/clienti/ClientForm";
import { createClientAction } from "@/modules/clienti/actions";
import { getStaffUsers } from "@/modules/clienti/queries";

export const metadata: Metadata = { title: "Nuovo cliente" };

export default async function NuovoClientePage() {
  const user = await requireStaff();
  const staff = await getStaffUsers();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Nuovo cliente"
        description="Compila la scheda anagrafica: le cartelle documenti verranno create automaticamente."
        backHref="/clienti"
        backLabel="Clienti"
      />
      <ClientForm
        action={createClientAction}
        staff={staff}
        mode="create"
        canToggleActive={user.ruolo === "ADMIN"}
        cancelHref="/clienti"
        initial={{ referenteId: user.id, attivo: "on" }}
      />
    </div>
  );
}
