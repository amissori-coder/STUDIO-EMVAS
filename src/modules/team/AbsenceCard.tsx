import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarRange } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, STATO_ASSENZA_COLOR, TIPO_ASSENZA_COLOR } from "@/components/ui/Badge";
import { STATI_ASSENZA, TIPI_ASSENZA } from "@/lib/constants";
import { cn, formatDate, formatRelative } from "@/lib/utils";
import { differenceInCalendarDays } from "date-fns";
import { AbsenceActions } from "./AbsenceActions";
import type { AbsenceItem } from "./queries";

export function durataGiorni(a: { dataInizio: Date; dataFine: Date }) {
  return differenceInCalendarDays(a.dataFine, a.dataInizio) + 1;
}

export function AbsenceCard({ a, isAdmin, currentUserId }: { a: AbsenceItem; isAdmin: boolean; currentUserId: string }) {
  const giorni = durataGiorni(a);
  const isOwner = a.userId === currentUserId;
  return (
    <li className={cn("flex flex-col gap-3 bg-white px-3 py-3 sm:px-4 lg:flex-row lg:items-start", a.stato === "RICHIESTA" && "bg-yellow-50/40")}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Avatar nome={a.user.nome} colore={a.user.colore} size="sm" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">
              {a.user.nome}
              {isOwner && <span className="ml-1 text-xs font-normal text-slate-400">(tu)</span>}
            </p>
            <Badge color={TIPO_ASSENZA_COLOR[a.tipo]}>{TIPI_ASSENZA[a.tipo as keyof typeof TIPI_ASSENZA] ?? a.tipo}</Badge>
            <Badge color={STATO_ASSENZA_COLOR[a.stato]}>{STATI_ASSENZA[a.stato as keyof typeof STATI_ASSENZA] ?? a.stato}</Badge>
          </div>
          <p className="mt-1 inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700">
            <CalendarRange className="h-4 w-4 text-slate-400" />
            {giorni === 1 ? (
              <span>{formatDate(a.dataInizio, "EEEE d MMMM yyyy")}</span>
            ) : (
              <span>
                dal {formatDate(a.dataInizio, "EEE d MMM yyyy")} al {formatDate(a.dataFine, "EEE d MMM yyyy")}
              </span>
            )}
            <span className="text-xs text-slate-500">
              · {giorni} {giorni === 1 ? "giorno" : "giorni"}
            </span>
          </p>
          {a.note && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{a.note}</p>}
          <p className="mt-1 text-xs text-slate-400">
            Richiesta {formatRelative(a.createdAt)}
            {a.stato !== "RICHIESTA" && a.approvedBy ? ` · ${a.stato === "APPROVATA" ? "approvata" : "rifiutata"} da ${a.approvedBy.nome}` : ""}
          </p>
          {a.taskARischio > 0 && a.stato !== "RIFIUTATA" && (
            <Link
              href={`/attivita?assegnatario=${a.userId}&stato=aperte&ordina=scadenza`}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-xs font-medium text-orange-800 hover:bg-orange-100"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {a.taskARischio} {a.taskARischio === 1 ? "attività scaduta o in scadenza" : "attività scadute o in scadenza"} durante l&apos;assenza
              <ArrowRight className="h-3.5 w-3.5" /> riassegna
            </Link>
          )}
        </div>
      </div>
      <div className="lg:shrink-0 lg:pl-2">
        <AbsenceActions absenceId={a.id} stato={a.stato} isAdmin={isAdmin} isOwner={isOwner} nome={a.user.nome} />
      </div>
    </li>
  );
}
