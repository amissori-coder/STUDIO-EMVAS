import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { AlertTriangle, CalendarDays, CalendarRange, ListChecks, Plus, Sun } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guards";
import { STATI_TASK_APERTI } from "@/lib/constants";
import { addDays, cn, endOfDayLocal, startOfDayLocal } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { TaskFilters } from "@/modules/attivita/TaskFilters";
import { TaskRow } from "@/modules/attivita/TaskRow";
import { buildTaskQuery, PAGE_SIZE, parseTaskFilters, raggruppaPerGiorno, type TaskFilters as Filtri } from "@/modules/attivita/lib";
import { caricaPaginaTasks } from "@/modules/attivita/queries";

export const metadata: Metadata = { title: "Attività" };

function buildWhere(f: Filtri, userId: string): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = {};
  if (f.stato === "aperte") where.stato = { in: STATI_TASK_APERTI };
  else if (f.stato !== "tutte") where.stato = f.stato;

  if (f.assegnatario === "me") where.assigneeId = userId;
  else if (f.assegnatario === "nessuno") where.assigneeId = null;
  else if (f.assegnatario) where.assigneeId = f.assegnatario;

  if (f.cliente) where.clientId = f.cliente;
  if (f.categoria) where.template = { categoria: f.categoria };
  if (f.template) where.templateId = f.template;
  if (f.anno) where.anno = f.anno;

  const oggi = startOfDayLocal(new Date());
  if (f.periodo === "scadute") where.scadenza = { lt: oggi };
  else if (f.periodo === "oggi") where.scadenza = { gte: oggi, lte: endOfDayLocal(oggi) };
  else if (f.periodo === "settimana") where.scadenza = { gte: oggi, lte: endOfDayLocal(addDays(oggi, 7)) };
  else if (f.periodo === "mese") where.scadenza = { gte: oggi, lte: endOfDayLocal(addDays(oggi, 30)) };

  if (f.ricerca) {
    where.OR = [{ titolo: { contains: f.ricerca } }, { client: { denominazione: { contains: f.ricerca } } }, { descrizione: { contains: f.ricerca } }];
  }
  return where;
}

export default async function AttivitaPage(props: PageProps<"/attivita">) {
  const user = await requireStaff();
  const sp = await props.searchParams;
  const filtri = parseTaskFilters(sp);
  const where = buildWhere(filtri, user.id);

  const oggi = startOfDayLocal(new Date());
  const [{ tasks: visibili, totale, pagine, pagina }, templateFiltro, utenti, clienti, nScadute, nOggi, nSettimana] = await Promise.all([
    caricaPaginaTasks(where, filtri.ordina, filtri.pagina),
    filtri.template ? prisma.adempimentoTemplate.findUnique({ where: { id: filtri.template }, select: { nome: true } }) : null,
    prisma.user.findMany({ where: { ruolo: { in: ["ADMIN", "COLLABORATORE"] }, attivo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.client.findMany({ where: { OR: [{ attivo: true }, ...(filtri.cliente ? [{ id: filtri.cliente }] : [])] }, select: { id: true, denominazione: true }, orderBy: { denominazione: "asc" } }),
    prisma.task.count({ where: { stato: { in: STATI_TASK_APERTI }, scadenza: { lt: oggi } } }),
    prisma.task.count({ where: { stato: { in: STATI_TASK_APERTI }, scadenza: { gte: oggi, lte: endOfDayLocal(oggi) } } }),
    prisma.task.count({ where: { stato: { in: STATI_TASK_APERTI }, scadenza: { gte: oggi, lte: endOfDayLocal(addDays(oggi, 7)) } } }),
  ]);

  const inizio = (pagina - 1) * PAGE_SIZE;
  const gruppi = filtri.ordina === "scadenza" ? raggruppaPerGiorno(visibili) : null;

  const riepilogo = [
    { label: "Scadute", n: nScadute, icon: AlertTriangle, href: `/attivita${buildTaskQuery({ periodo: "scadute" })}`, tone: nScadute > 0 ? "text-red-600" : "text-slate-500", active: filtri.periodo === "scadute" },
    { label: "Oggi", n: nOggi, icon: Sun, href: `/attivita${buildTaskQuery({ periodo: "oggi" })}`, tone: nOggi > 0 ? "text-amber-600" : "text-slate-500", active: filtri.periodo === "oggi" },
    { label: "Prossimi 7 giorni", n: nSettimana, icon: CalendarRange, href: `/attivita${buildTaskQuery({ periodo: "settimana" })}`, tone: "text-blue-600", active: filtri.periodo === "settimana" },
  ];

  return (
    <>
      <PageHeader
        title="Attività"
        description="Scadenze e attività dello studio, manuali e generate dagli adempimenti."
        actions={
          <>
            <Button href="/scadenzario" variant="outline">
              <CalendarDays className="h-4 w-4" /> Scadenzario
            </Button>
            <Button href="/attivita/nuova">
              <Plus className="h-4 w-4" /> Nuova attività
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        {riepilogo.map((r) => (
          <Link
            key={r.label}
            href={r.href}
            className={cn(
              "flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm transition-colors hover:border-blue-300 sm:gap-3 sm:px-4 sm:py-3",
              r.active ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200",
            )}
          >
            <r.icon className={cn("hidden h-5 w-5 shrink-0 sm:block", r.tone)} />
            <div className="min-w-0">
              <p className={cn("text-xl font-semibold leading-tight sm:text-2xl", r.tone)}>{r.n}</p>
              <p className="truncate text-[11px] text-slate-500 sm:text-xs">{r.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <TaskFilters filtri={filtri} utenti={utenti} clienti={clienti} userId={user.id} templateNome={filtri.template ? (templateFiltro?.nome ?? "adempimento non trovato") : null} />

      <div className="mt-4">
        {visibili.length === 0 ? (
          <EmptyState
            icon={<ListChecks />}
            title="Nessuna attività trovata"
            description={totale === 0 && filtri.stato === "aperte" && !filtri.ricerca ? "Non ci sono attività aperte con questi filtri. Crea una nuova attività o pianifica gli adempimenti dei clienti." : "Prova a modificare i filtri di ricerca."}
            action={
              <Button href="/attivita/nuova">
                <Plus className="h-4 w-4" /> Nuova attività
              </Button>
            }
          />
        ) : gruppi ? (
          <div className="space-y-5">
            {gruppi.map((g) => (
              <section key={g.key}>
                <h2 className={cn("mb-2 flex items-center gap-2 text-sm font-semibold", g.scaduto ? "text-red-600" : "text-slate-700")}>
                  {g.scaduto && <AlertTriangle className="h-4 w-4" />}
                  {g.label}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{g.items.length}</span>
                </h2>
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                  {g.items.map((t) => (
                    <TaskRow key={t.id} task={t} userId={user.id} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
            {visibili.map((t) => (
              <TaskRow key={t.id} task={t} userId={user.id} />
            ))}
          </ul>
        )}

        {visibili.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
            <p>
              {inizio + 1}–{inizio + visibili.length} di {totale} attività
            </p>
            {pagine > 1 && (
              <div className="flex items-center gap-2">
                {pagina > 1 && (
                  <Button href={`/attivita${buildTaskQuery({ ...filtri, pagina: pagina - 1 })}`} variant="outline" size="sm">
                    Precedenti
                  </Button>
                )}
                <span>
                  Pagina {pagina} di {pagine}
                </span>
                {pagina < pagine && (
                  <Button href={`/attivita${buildTaskQuery({ ...filtri, pagina: pagina + 1 })}`} variant="outline" size="sm">
                    Successive
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
