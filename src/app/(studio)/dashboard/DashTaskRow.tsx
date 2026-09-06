import Link from "next/link";
import { Building2, Check } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, PRIORITA_COLOR } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { PRIORITA_TASK } from "@/lib/constants";
import { cn, daysUntil, describeDeadline, formatDate } from "@/lib/utils";
import { completaTaskDashboardAction } from "@/modules/team/actions";
import type { DashTask } from "@/modules/team/dashboard";

/** Riga compatta di un'attività nella dashboard, con azione rapida "Completa". */
export function DashTaskRow({ task, showAssignee = false, quickComplete = false }: { task: DashTask; showAssignee?: boolean; quickComplete?: boolean }) {
  const diff = daysUntil(task.scadenza);
  const scaduta = diff < 0;
  const oggi = diff === 0;
  return (
    <li className={cn("flex items-center gap-3 px-3 py-2.5 sm:px-4", scaduta && "bg-red-50/40")}>
      <div className="min-w-0 flex-1">
        <Link href={`/attivita/${task.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-blue-700">
          {task.titolo}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
          <span className={cn("font-medium", scaduta ? "text-red-600" : oggi ? "text-amber-600" : "text-slate-600")}>
            {formatDate(task.scadenza)} · {describeDeadline(task.scadenza)}
          </span>
          {task.client && (
            <Link href={`/clienti/${task.client.id}`} className="inline-flex min-w-0 items-center gap-1 hover:text-blue-700">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{task.client.denominazione}</span>
            </Link>
          )}
          {task.priorita === "ALTA" && <Badge color={PRIORITA_COLOR.ALTA}>{PRIORITA_TASK.ALTA}</Badge>}
        </div>
      </div>
      {showAssignee &&
        (task.assignee ? <Avatar nome={task.assignee.nome} colore={task.assignee.colore} size="xs" /> : <span className="text-[11px] text-slate-400">Non assegnata</span>)}
      {quickComplete && (
        <form action={completaTaskDashboardAction}>
          <input type="hidden" name="id" value={task.id} />
          <button type="submit" className={buttonClasses({ variant: "outline", size: "sm", className: "h-10 sm:h-8" })} title="Segna come completata">
            <Check className="h-4 w-4 text-green-600" />
            <span className="hidden sm:inline">Completa</span>
          </button>
        </form>
      )}
    </li>
  );
}
