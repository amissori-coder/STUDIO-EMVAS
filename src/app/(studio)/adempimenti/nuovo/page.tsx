import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { TemplateForm } from "@/modules/adempimenti/TemplateForm";

export const metadata: Metadata = { title: "Nuovo adempimento" };

export default async function NuovoAdempimentoPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Nuovo adempimento" description="Definisci le scadenze e i criteri di applicabilità: verranno usati per generare le attività dei clienti." backHref="/adempimenti" backLabel="Catalogo adempimenti" />
      <Card>
        <CardBody>
          <TemplateForm
            valori={{
              codice: "",
              nome: "",
              descrizione: "",
              categoria: "ALTRO",
              ricorrenza: "ANNUALE",
              scadenze: "[]",
              regimi: [],
              tipiSoggetto: [],
              soloConDipendenti: null,
              soloConIva: null,
              periodicitaIva: null,
              soloSuRichiesta: false,
              giorniPreavviso: 7,
              attivo: true,
              ordine: 100,
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
