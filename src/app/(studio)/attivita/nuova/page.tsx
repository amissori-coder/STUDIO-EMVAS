import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { TaskForm } from "@/modules/attivita/TaskForm";
import { creaTask } from "@/modules/attivita/actions";
import { caricaOpzioniForm } from "@/modules/attivita/opzioni";
import { PRIORITA_TASK } from "@/lib/constants";

export const metadata: Metadata = { title: "Nuova attività" };

function str(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function NuovaAttivitaPage(props: PageProps<"/attivita/nuova">) {
  const user = await requireStaff();
  const sp = await props.searchParams;
  const clienteId = str(sp.cliente);
  const { clienti, utenti, templates } = await caricaOpzioniForm({ includiClienteId: clienteId || null });

  const priorita = str(sp.priorita);
  const scadenza = str(sp.scadenza);
  const valori = {
    titolo: str(sp.titolo).slice(0, 200),
    descrizione: str(sp.descrizione).slice(0, 5000),
    clientId: clienti.some((c) => c.id === clienteId) ? clienteId : "",
    scadenza: /^\d{4}-\d{2}-\d{2}$/.test(scadenza) ? scadenza : "",
    priorita: priorita in PRIORITA_TASK ? priorita : "MEDIA",
    assigneeId: utenti.some((u) => u.id === str(sp.assegnatario)) ? str(sp.assegnatario) : user.id,
    templateId: templates.some((t) => t.id === str(sp.template)) ? str(sp.template) : "",
    giorniPreavviso: 7,
  };
  const cancelHref = valori.clientId ? `/clienti/${valori.clientId}?tab=attivita` : "/attivita";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nuova attività" description="Crea una scadenza o un'attività manuale, per un cliente o interna allo studio." backHref={cancelHref} backLabel={valori.clientId ? "Scheda cliente" : "Attività"} />
      <Card>
        <CardBody>
          <TaskForm action={creaTask} valori={valori} clienti={clienti} utenti={utenti} templates={templates} submitLabel="Crea attività" cancelHref={cancelHref} />
        </CardBody>
      </Card>
    </div>
  );
}
