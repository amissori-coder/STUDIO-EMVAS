import type { Metadata } from "next";
import { CalendarOff, Users } from "lucide-react";
import { requireStaff } from "@/lib/auth/guards";
import { TIPI_ASSENZA } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, TIPO_ASSENZA_COLOR } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { AbsenceCalendar } from "@/modules/team/AbsenceCalendar";
import { AbsenceCard } from "@/modules/team/AbsenceCard";
import { AbsenceFilters } from "@/modules/team/AbsenceFilters";
import { labelMese, parseAbsenceFilters, parseMese } from "@/modules/team/absence-filters";
import { AbsenceRequestButton } from "@/modules/team/AbsenceRequestButton";
import { TeamTabs } from "@/modules/team/TeamTabs";
import { countPendingAbsences, getStaffOptions, listAbsencesForMonth, listAbsentToday } from "@/modules/team/queries";

export const metadata: Metadata = { title: "Assenze" };

export default async function AssenzePage(props: PageProps<"/team/assenze">) {
  const user = await requireStaff();
  const isAdmin = user.ruolo === "ADMIN";
  const sp = await props.searchParams;
  const filtri = parseAbsenceFilters(sp);
  const { anno, mese } = parseMese(filtri.mese);

  const [assenze, oggi, utenti, pending] = await Promise.all([listAbsencesForMonth(filtri), listAbsentToday(), getStaffOptions(), countPendingAbsences()]);
  const inAttesa = assenze.filter((a) => a.stato === "RICHIESTA");
  const altre = assenze.filter((a) => a.stato !== "RICHIESTA");

  return (
    <>
      <PageHeader
        title="Team e assenze"
        description="Ferie, permessi e malattie di tutto lo studio."
        actions={<AbsenceRequestButton isAdmin={isAdmin} currentUserId={user.id} utenti={utenti} />}
      />
      <TeamTabs active="assenze" pendingAbsences={isAdmin ? pending : 0} />

      <Card className="mb-4">
        <CardHeader title="Chi è assente oggi" description={formatDate(new Date(), "EEEE d MMMM yyyy")} />
        <CardBody>
          {oggi.length === 0 ? (
            <p className="text-sm text-slate-500">Oggi tutto il team è presente.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {oggi.map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-3 text-sm">
                  <Avatar nome={a.user.nome} colore={a.user.colore} size="xs" />
                  <span className="font-medium text-slate-800">{a.user.nome}</span>
                  <Badge color={TIPO_ASSENZA_COLOR[a.tipo]}>{TIPI_ASSENZA[a.tipo as keyof typeof TIPI_ASSENZA] ?? a.tipo}</Badge>
                  <span className="text-xs text-slate-500">fino al {formatDate(a.dataFine)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <AbsenceFilters filtri={filtri} utenti={utenti} />

      <div className="mt-4 space-y-5">
        {filtri.vista === "calendario" && <AbsenceCalendar anno={anno} mese={mese} assenze={assenze} />}

        {assenze.length === 0 ? (
          filtri.vista === "elenco" && (
            <EmptyState
              icon={<CalendarOff />}
              title={`Nessuna assenza a ${labelMese(filtri.mese).toLowerCase()}`}
              description={filtri.utente || filtri.stato ? "Prova a modificare i filtri." : "Le richieste di assenza del team compariranno qui."}
            />
          )
        ) : (
          <>
            {inAttesa.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-yellow-800">
                  <Users className="h-4 w-4" /> In attesa di approvazione
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">{inAttesa.length}</span>
                </h2>
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-yellow-200 shadow-sm">
                  {inAttesa.map((a) => (
                    <AbsenceCard key={a.id} a={a} isAdmin={isAdmin} currentUserId={user.id} />
                  ))}
                </ul>
              </section>
            )}
            {altre.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  {labelMese(filtri.mese)}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{altre.length}</span>
                </h2>
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                  {altre.map((a) => (
                    <AbsenceCard key={a.id} a={a} isAdmin={isAdmin} currentUserId={user.id} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
