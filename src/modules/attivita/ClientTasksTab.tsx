import Link from "next/link";
import { CheckCircle2, ListChecks, Plus } from "lucide-react";
import type { CurrentUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { STATI_TASK_APERTI } from "@/lib/constants";
import { anteprimaPianificazione } from "@/lib/adempimenti/engine";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PianificazioneCard } from "@/modules/attivita/PianificazioneCard";
import { TaskRow } from "@/modules/attivita/TaskRow";
import { serializzaAnteprima } from "@/modules/attivita/pianificazione";
import { TASK_LIST_INCLUDE } from "@/modules/attivita/lib";

/** Tab "Attività" nella scheda cliente: pianificazione adempimenti + elenco attività del cliente. */
export async function ClientTasksTab({ clientId, user }: { clientId: string; user: CurrentUser }) {
  const anno = new Date().getFullYear();
  const [aperte, chiuse, anteprima] = await Promise.all([
    prisma.task.findMany({ where: { clientId, stato: { in: STATI_TASK_APERTI } }, include: TASK_LIST_INCLUDE, orderBy: { scadenza: "asc" } }),
    prisma.task.findMany({ where: { clientId, stato: { notIn: STATI_TASK_APERTI } }, include: TASK_LIST_INCLUDE, orderBy: { scadenza: "desc" }, take: 200 }),
    anteprimaPianificazione(clientId, anno),
  ]);
  const scadute = aperte.filter((t) => t.scadenza < new Date(new Date().setHours(0, 0, 0, 0))).length;

  return (
    <div className="space-y-5">
      <PianificazioneCard clientId={clientId} annoIniziale={anno} righeIniziali={serializzaAnteprima(anteprima)} />

      <Card>
        <CardHeader
          title="Attività aperte"
          description={aperte.length ? `${aperte.length} attività da fare o in corso${scadute ? ` · ${scadute} scadute` : ""}` : "Nessuna attività aperta"}
          actions={
            <Button href={`/attivita/nuova?cliente=${clientId}`} size="sm">
              <Plus className="h-4 w-4" /> Nuova attività
            </Button>
          }
        />
        {aperte.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={<ListChecks />}
              title="Nessuna attività aperta per questo cliente"
              description="Genera gli adempimenti dell'anno con la pianificazione qui sopra oppure crea un'attività manuale."
            />
          </CardBody>
        ) : (
          <ul className="divide-y divide-slate-100">
            {aperte.map((t) => (
              <TaskRow key={t.id} task={t} userId={user.id} showClient={false} />
            ))}
          </ul>
        )}
      </Card>

      {chiuse.length > 0 && (
        <details className="group rounded-xl border border-slate-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 sm:px-5">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Completate e annullate ({chiuse.length})
            <span className="ml-auto text-xs text-slate-400 group-open:hidden">mostra</span>
            <span className="ml-auto hidden text-xs text-slate-400 group-open:inline">nascondi</span>
          </summary>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {chiuse.map((t) => (
              <TaskRow key={t.id} task={t} userId={user.id} showClient={false} compact />
            ))}
          </ul>
          <p className="px-4 py-2 text-xs text-slate-500 sm:px-5">
            <Link href={`/attivita?cliente=${clientId}&stato=tutte`} className="hover:text-blue-700">
              Vedi tutte le attività del cliente nell&apos;elenco completo
            </Link>
          </p>
        </details>
      )}
    </div>
  );
}
