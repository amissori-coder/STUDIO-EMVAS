import Link from "next/link";
import { Building2, CalendarClock, Check, Hand, RotateCcw } from "lucide-react";
import { Badge, PRIORITA_COLOR, STATO_TASK_COLOR } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { PRIORITA_TASK, STATI_TASK } from "@/lib/constants";
import { cn, describeDeadline, formatDate } from "@/lib/utils";
import { isTaskAperta, isTaskScaduta, type TaskListItem } from "@/modules/attivita/lib";
import { completaTaskRapida, prendiInCaricoRapida, riapriTaskRapida } from "@/modules/attivita/actions";

/**
 * Riga/card di un'attività con azioni rapide (form inline con server action).
 * Utilizzabile in elenchi sia nella pagina Attività sia nella scheda cliente.
 */
export function TaskRow({
  task,
  userId,
  showClient = true,
  showDate = true,
  compact = false,
}: {
  task: TaskListItem;
  userId: string;
  showClient?: boolean;
  showDate?: boolean;
  compact?: boolean;
}) {
  const aperta = isTaskAperta(task.stato);
  const scaduta = isTaskScaduta(task);
  const miaInCorso = task.assigneeId === userId && task.stato === "IN_CORSO";

  return (
    <li
      className={cn(
        "flex flex-col gap-2 border-l-4 bg-white px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4",
        scaduta ? "border-l-red-500" : task.stato === "COMPLETATA" ? "border-l-green-400" : task.stato === "ANNULLATA" ? "border-l-slate-300" : task.priorita === "ALTA" ? "border-l-orange-400" : "border-l-transparent",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <Link
            href={`/attivita/${task.id}`}
            className={cn("min-w-0 flex-1 text-sm font-medium text-slate-900 hover:text-blue-700", !aperta && "text-slate-500 line-through decoration-slate-300")}
          >
            {task.titolo}
          </Link>
          {task.assignee ? (
            <Avatar nome={task.assignee.nome} colore={task.assignee.colore} size="xs" className="mt-0.5 sm:hidden" />
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {showClient && task.client && (
            <Link href={`/clienti/${task.client.id}`} className="inline-flex items-center gap-1 hover:text-blue-700">
              <Building2 className="h-3.5 w-3.5" />
              <span className="truncate">{task.client.denominazione}</span>
            </Link>
          )}
          {showDate && (
            <span className={cn("inline-flex items-center gap-1", scaduta && "font-medium text-red-600")}>
              <CalendarClock className="h-3.5 w-3.5" />
              {formatDate(task.scadenza)}
              {aperta ? <span>· {describeDeadline(task.scadenza)}</span> : task.completatoAt ? <span>· completata il {formatDate(task.completatoAt)}</span> : null}
            </span>
          )}
          {task.template && !compact && <span className="hidden sm:inline">{task.template.nome}</span>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        <Badge color={STATO_TASK_COLOR[task.stato]}>{STATI_TASK[task.stato as keyof typeof STATI_TASK] ?? task.stato}</Badge>
        <Badge color={PRIORITA_COLOR[task.priorita]}>{PRIORITA_TASK[task.priorita as keyof typeof PRIORITA_TASK] ?? task.priorita}</Badge>
        {task.assignee ? (
          // wrapper: la classe base `inline-flex` di Avatar prevarrebbe su `hidden`
          <span className="hidden sm:inline-flex">
            <Avatar nome={task.assignee.nome} colore={task.assignee.colore} size="sm" />
          </span>
        ) : (
          <span className="hidden text-xs text-slate-400 sm:inline">Non assegnata</span>
        )}
        <div className="ml-auto flex items-center gap-1 sm:ml-0">
          {aperta && !miaInCorso && (
            <form action={prendiInCaricoRapida}>
              <input type="hidden" name="id" value={task.id} />
              <button type="submit" className={buttonClasses({ variant: "ghost", size: "sm", className: "h-10 sm:h-8" })} title="Prendi in carico">
                <Hand className="h-4 w-4" />
                <span className="sm:sr-only lg:not-sr-only">In carico</span>
              </button>
            </form>
          )}
          {aperta && (
            <form action={completaTaskRapida}>
              <input type="hidden" name="id" value={task.id} />
              <button type="submit" className={buttonClasses({ variant: "outline", size: "sm", className: "h-10 sm:h-8" })} title="Segna come completata">
                <Check className="h-4 w-4 text-green-600" />
                Completa
              </button>
            </form>
          )}
          {!aperta && (
            <form action={riapriTaskRapida}>
              <input type="hidden" name="id" value={task.id} />
              <button type="submit" className={buttonClasses({ variant: "ghost", size: "sm", className: "h-10 sm:h-8" })} title="Riapri">
                <RotateCcw className="h-4 w-4" />
                Riapri
              </button>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}
