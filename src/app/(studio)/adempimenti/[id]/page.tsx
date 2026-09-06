import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { safeJsonParse } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { TemplateForm } from "@/modules/adempimenti/TemplateForm";
import { eliminaTemplate } from "@/modules/adempimenti/actions";

export const metadata: Metadata = { title: "Modifica adempimento" };

export default async function ModificaAdempimentoPage(props: PageProps<"/adempimenti/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const [t, nTask, nOverride] = await Promise.all([
    prisma.adempimentoTemplate.findUnique({ where: { id } }),
    prisma.task.count({ where: { templateId: id } }),
    prisma.clientAdempimentoOverride.count({ where: { templateId: id } }),
  ]);
  if (!t) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t.nome} description={`Codice ${t.codice} · ${nTask} attività collegate · ${nOverride} attivazioni/disattivazioni per cliente`} backHref="/adempimenti" backLabel="Catalogo adempimenti" />
      <Card>
        <CardBody>
          <TemplateForm
            valori={{
              id: t.id,
              codice: t.codice,
              nome: t.nome,
              descrizione: t.descrizione,
              categoria: t.categoria,
              ricorrenza: t.ricorrenza,
              scadenze: t.scadenze,
              regimi: safeJsonParse<string[]>(t.regimi, []),
              tipiSoggetto: safeJsonParse<string[]>(t.tipiSoggetto, []),
              soloConDipendenti: t.soloConDipendenti,
              soloConIva: t.soloConIva,
              periodicitaIva: t.periodicitaIva,
              soloSuRichiesta: t.soloSuRichiesta,
              giorniPreavviso: t.giorniPreavviso,
              attivo: t.attivo,
              ordine: t.ordine,
            }}
          />
        </CardBody>
      </Card>
      <Card className="mt-4 border-red-100">
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Eliminando l&apos;adempimento le attività già generate restano (senza collegamento al catalogo). Per sospenderlo temporaneamente è preferibile disattivarlo.
          </p>
          <form action={eliminaTemplate}>
            <input type="hidden" name="id" value={t.id} />
            <ConfirmButton message={`Eliminare definitivamente l'adempimento "${t.nome}"?`} variant="danger" size="sm">
              <Trash2 className="h-4 w-4" /> Elimina adempimento
            </ConfirmButton>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
