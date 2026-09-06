import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, ListChecks, Plane, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guards";
import { STATI_ASSENZA, TIPI_ASSENZA } from "@/lib/constants";
import { festivita } from "@/lib/adempimenti/calendario";
import { addDays, cn, endOfDayLocal, formatDate, formatDateLong, parseDateInput, startOfDayLocal } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, STATO_ASSENZA_COLOR, TIPO_ASSENZA_COLOR } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { CalendarioFiltri } from "@/modules/attivita/CalendarioFiltri";
import { TaskRow } from "@/modules/attivita/TaskRow";
import { capitalize, isTaskScaduta, TASK_LIST_INCLUDE, type TaskListItem } from "@/modules/attivita/lib";

export const metadata: Metadata = { title: "Scadenzario" };

const GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const GIORNI_LUNGHI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

function str(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function chiave(d: Date) {
  return formatDate(d, "yyyy-MM-dd");
}

interface AssenzaVoce {
  id: string;
  tipo: string;
  stato: string;
  dataInizio: Date;
  dataFine: Date;
  user: { id: string; nome: string; colore: string };
}

/** Classe colore del chip attività nel calendario. */
function tonoTask(t: TaskListItem) {
  if (t.stato === "COMPLETATA") return "bg-green-50 text-green-700 line-through decoration-green-300 hover:bg-green-100";
  if (isTaskScaduta(t)) return "bg-red-100 text-red-800 hover:bg-red-200";
  if (t.priorita === "ALTA") return "bg-orange-100 text-orange-800 hover:bg-orange-200";
  if (t.stato === "IN_CORSO") return "bg-blue-100 text-blue-800 hover:bg-blue-200";
  return "bg-slate-100 text-slate-700 hover:bg-slate-200";
}

function puntoTask(t: TaskListItem) {
  if (t.stato === "COMPLETATA") return "bg-green-400";
  if (isTaskScaduta(t)) return "bg-red-500";
  if (t.priorita === "ALTA") return "bg-orange-500";
  return "bg-blue-500";
}

export default async function ScadenzarioPage(props: PageProps<"/scadenzario">) {
  const user = await requireStaff();
  const sp = await props.searchParams;

  const oggi = startOfDayLocal(new Date());
  const meseParam = /^\d{4}-\d{2}$/.test(str(sp.mese)) ? str(sp.mese) : formatDate(oggi, "yyyy-MM");
  const [annoStr, meseStr] = meseParam.split("-");
  const anno = Number(annoStr);
  const meseIdx = Math.min(12, Math.max(1, Number(meseStr))) - 1;
  const primo = new Date(anno, meseIdx, 1);
  const ultimo = new Date(anno, meseIdx + 1, 0);
  // Giorno selezionato: una data non valida (es. 2026-13-01 o 2026-02-31) equivale a nessuna selezione
  const giornoInput = parseDateInput(str(sp.giorno));
  const giornoSel = giornoInput && chiave(giornoInput) === str(sp.giorno).trim() ? giornoInput : null;
  const giornoParam = giornoSel ? chiave(giornoSel) : "";
  const assegnatario = str(sp.assegnatario);
  const cliente = str(sp.cliente);

  // Griglia: da lunedì della prima settimana a domenica dell'ultima
  const offsetInizio = (primo.getDay() + 6) % 7;
  const inizioGriglia = addDays(primo, -offsetInizio);
  const offsetFine = (7 - ((ultimo.getDay() + 6) % 7) - 1) % 7;
  const fineGriglia = addDays(ultimo, offsetFine);

  const [tasks, assenze, utenti, clienti] = await Promise.all([
    prisma.task.findMany({
      where: {
        scadenza: { gte: startOfDayLocal(inizioGriglia), lte: endOfDayLocal(fineGriglia) },
        stato: { not: "ANNULLATA" },
        ...(assegnatario ? { assigneeId: assegnatario } : {}),
        ...(cliente ? { clientId: cliente } : {}),
      },
      include: TASK_LIST_INCLUDE,
      orderBy: [{ scadenza: "asc" }, { priorita: "asc" }],
    }),
    prisma.absence.findMany({
      where: {
        stato: { in: ["APPROVATA", "RICHIESTA"] },
        dataInizio: { lte: endOfDayLocal(fineGriglia) },
        dataFine: { gte: startOfDayLocal(inizioGriglia) },
        ...(assegnatario ? { userId: assegnatario } : {}),
      },
      select: { id: true, tipo: true, stato: true, dataInizio: true, dataFine: true, user: { select: { id: true, nome: true, colore: true } } },
      orderBy: { dataInizio: "asc" },
    }),
    prisma.user.findMany({ where: { ruolo: { in: ["ADMIN", "COLLABORATORE"] }, attivo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.client.findMany({ where: { OR: [{ attivo: true }, ...(cliente ? [{ id: cliente }] : [])] }, select: { id: true, denominazione: true }, orderBy: { denominazione: "asc" } }),
  ]);

  // Indicizzazione per giorno
  const perGiorno = new Map<string, TaskListItem[]>();
  for (const t of tasks) {
    const k = chiave(t.scadenza);
    perGiorno.set(k, [...(perGiorno.get(k) ?? []), t]);
  }
  const assenzePerGiorno = new Map<string, AssenzaVoce[]>();
  for (const a of assenze) {
    for (let d = startOfDayLocal(a.dataInizio < inizioGriglia ? inizioGriglia : a.dataInizio); d <= a.dataFine && d <= fineGriglia; d = addDays(d, 1)) {
      const k = chiave(d);
      assenzePerGiorno.set(k, [...(assenzePerGiorno.get(k) ?? []), a]);
    }
  }
  const festivi = festivita(anno);

  const giorni: Date[] = [];
  for (let d = inizioGriglia; d <= fineGriglia; d = addDays(d, 1)) giorni.push(d);
  const settimane: Date[][] = [];
  for (let i = 0; i < giorni.length; i += 7) settimane.push(giorni.slice(i, i + 7));

  const base = (patch: { mese?: string; giorno?: string | null }) => {
    const p = new URLSearchParams();
    p.set("mese", patch.mese ?? meseParam);
    const g = patch.giorno === undefined ? giornoParam : patch.giorno;
    if (g) p.set("giorno", g);
    if (assegnatario) p.set("assegnatario", assegnatario);
    if (cliente) p.set("cliente", cliente);
    return `/scadenzario?${p.toString()}`;
  };
  const mesePrec = formatDate(new Date(anno, meseIdx - 1, 1), "yyyy-MM");
  const meseSucc = formatDate(new Date(anno, meseIdx + 1, 1), "yyyy-MM");
  const titoloMese = capitalize(formatDate(primo, "MMMM yyyy"));
  const nelMese = tasks.filter((t) => t.scadenza >= primo && t.scadenza <= endOfDayLocal(ultimo));
  const chiaveOggi = chiave(oggi);

  const tasksGiorno = giornoParam ? (perGiorno.get(giornoParam) ?? []) : [];
  const assenzeGiorno = giornoParam ? (assenzePerGiorno.get(giornoParam) ?? []) : [];

  // Agenda del mese (mobile): solo giorni con attività o assenze
  const agenda = giorni
    .filter((d) => d >= primo && d <= ultimo)
    .map((d) => ({ d, k: chiave(d), tasks: perGiorno.get(chiave(d)) ?? [], assenze: assenzePerGiorno.get(chiave(d)) ?? [] }))
    .filter((x) => x.tasks.length || x.assenze.length);

  return (
    <>
      <PageHeader
        title="Scadenzario"
        description={`${nelMese.length} attività nel mese${assenze.length ? ` · ${assenze.length} assenze` : ""}`}
        actions={
          <>
            <Button href="/attivita" variant="outline">
              <ListChecks className="h-4 w-4" /> Elenco attività
            </Button>
            <Button href={`/attivita/nuova${giornoParam ? `?scadenza=${giornoParam}` : ""}`}>
              <Plus className="h-4 w-4" /> Nuova attività
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Link href={base({ mese: mesePrec, giorno: null })} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50" aria-label="Mese precedente">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h2 className="min-w-[10rem] text-center text-lg font-semibold text-slate-900">{titoloMese}</h2>
          <Link href={base({ mese: meseSucc, giorno: null })} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50" aria-label="Mese successivo">
            <ChevronRight className="h-5 w-5" />
          </Link>
          <Button href={base({ mese: formatDate(oggi, "yyyy-MM"), giorno: chiaveOggi })} variant="secondary" size="sm">
            Oggi
          </Button>
        </div>
        <div className="lg:w-[28rem]">
          <CalendarioFiltri mese={meseParam} giorno={giornoParam} assegnatario={assegnatario} cliente={cliente} utenti={utenti} clienti={clienti} userId={user.id} />
        </div>
      </div>

      {/* Griglia desktop / tablet */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
          {GIORNI.map((g) => (
            <div key={g} className="py-2">
              {g}
            </div>
          ))}
        </div>
        {settimane.map((sett, i) => (
          <div key={i} className="grid grid-cols-7 border-b border-slate-100 last:border-b-0">
            {sett.map((d) => {
              const k = chiave(d);
              const fuoriMese = d < primo || d > ultimo;
              const festivo = d.getDay() === 0 || festivi.has(`${d.getMonth() + 1}-${d.getDate()}`);
              const isOggi = k === chiaveOggi;
              const isSel = k === giornoParam;
              const items = perGiorno.get(k) ?? [];
              const ass = assenzePerGiorno.get(k) ?? [];
              return (
                <div
                  key={k}
                  className={cn(
                    "min-h-[7rem] border-r border-slate-100 p-1.5 last:border-r-0",
                    fuoriMese ? "bg-slate-50/70" : festivo ? "bg-rose-50/40" : d.getDay() === 6 ? "bg-slate-50/40" : "bg-white",
                    isSel && "ring-2 ring-inset ring-blue-400",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <Link
                      href={base({ giorno: k })}
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium hover:bg-slate-200",
                        isOggi ? "bg-blue-600 text-white hover:bg-blue-700" : fuoriMese ? "text-slate-400" : festivo ? "text-rose-600" : "text-slate-700",
                      )}
                    >
                      {d.getDate()}
                    </Link>
                    {ass.length > 0 && (
                      <span className="flex -space-x-1" title={ass.map((a) => `${a.user.nome}: ${TIPI_ASSENZA[a.tipo as keyof typeof TIPI_ASSENZA] ?? a.tipo}`).join(", ")}>
                        {ass.slice(0, 3).map((a) => (
                          <Avatar key={a.id} nome={a.user.nome} colore={a.user.colore} size="xs" className={cn("ring-2 ring-white", a.stato === "RICHIESTA" && "opacity-60")} />
                        ))}
                      </span>
                    )}
                  </div>
                  <ul className="space-y-0.5">
                    {items.slice(0, 3).map((t) => (
                      <li key={t.id}>
                        <Link href={`/attivita/${t.id}`} className={cn("block truncate rounded px-1.5 py-0.5 text-[11px] leading-4", tonoTask(t))} title={`${t.titolo}${t.client ? ` · ${t.client.denominazione}` : ""}`}>
                          {t.titolo}
                        </Link>
                      </li>
                    ))}
                    {items.length > 3 && (
                      <li>
                        <Link href={base({ giorno: k })} className="block px-1.5 text-[11px] font-medium text-blue-700 hover:underline">
                          +{items.length - 3} altre
                        </Link>
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Griglia compatta mobile */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-[11px] font-semibold uppercase text-slate-500">
          {GIORNI.map((g) => (
            <div key={g} className="py-1.5">
              {g}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {giorni.map((d) => {
            const k = chiave(d);
            const fuoriMese = d < primo || d > ultimo;
            const festivo = d.getDay() === 0 || festivi.has(`${d.getMonth() + 1}-${d.getDate()}`);
            const isOggi = k === chiaveOggi;
            const isSel = k === giornoParam;
            const items = perGiorno.get(k) ?? [];
            const ass = assenzePerGiorno.get(k) ?? [];
            return (
              <Link
                key={k}
                href={`${base({ giorno: k })}#giorno`}
                className={cn(
                  "flex h-12 flex-col items-center justify-center gap-1 border-b border-r border-slate-100 text-sm",
                  fuoriMese ? "text-slate-300" : festivo ? "text-rose-600" : "text-slate-800",
                  isSel && "bg-blue-50",
                )}
              >
                <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full", isOggi && "bg-blue-600 font-semibold text-white")}>{d.getDate()}</span>
                <span className="flex h-1.5 items-center gap-0.5">
                  {items.slice(0, 3).map((t) => (
                    <span key={t.id} className={cn("h-1.5 w-1.5 rounded-full", puntoTask(t))} />
                  ))}
                  {ass.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <Legenda colore="bg-red-500">Scaduta</Legenda>
        <Legenda colore="bg-orange-500">Priorità alta</Legenda>
        <Legenda colore="bg-blue-500">Da fare / in corso</Legenda>
        <Legenda colore="bg-green-400">Completata</Legenda>
        <Legenda colore="bg-purple-400">Assenza</Legenda>
      </div>

      {/* Dettaglio giorno selezionato */}
      {giornoSel ? (
        <section id="giorno" className="mt-5 scroll-mt-16">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              {GIORNI_LUNGHI[(giornoSel.getDay() + 6) % 7]} {formatDate(giornoSel, "d MMMM yyyy")}
              {chiave(giornoSel) === chiaveOggi && <Badge color="blue" className="ml-2">Oggi</Badge>}
            </h3>
            <div className="flex items-center gap-2">
              <Button href={`/attivita/nuova?scadenza=${giornoParam}`} variant="outline" size="sm">
                <Plus className="h-4 w-4" /> Attività in questo giorno
              </Button>
              <Link href={base({ giorno: null })} className="text-sm text-slate-500 hover:text-slate-800">
                Chiudi
              </Link>
            </div>
          </div>
          {assenzeGiorno.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-2">
              {assenzeGiorno.map((a) => (
                <li key={a.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs">
                  <Plane className="h-3.5 w-3.5 text-purple-500" />
                  <Avatar nome={a.user.nome} colore={a.user.colore} size="xs" />
                  <span className="font-medium text-slate-800">{a.user.nome}</span>
                  <Badge color={TIPO_ASSENZA_COLOR[a.tipo]}>{TIPI_ASSENZA[a.tipo as keyof typeof TIPI_ASSENZA] ?? a.tipo}</Badge>
                  <Badge color={STATO_ASSENZA_COLOR[a.stato]}>{STATI_ASSENZA[a.stato as keyof typeof STATI_ASSENZA] ?? a.stato}</Badge>
                  <span className="text-slate-500">
                    {formatDate(a.dataInizio)} – {formatDate(a.dataFine)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {tasksGiorno.length === 0 ? (
            <EmptyState icon={<CalendarDays />} title="Nessuna attività in questo giorno" description="Puoi crearne una con il pulsante qui sopra." />
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
              {tasksGiorno.map((t) => (
                <TaskRow key={t.id} task={t} userId={user.id} showDate={false} />
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="mt-5 md:hidden">
          <h3 className="mb-2 text-base font-semibold text-slate-900">Agenda di {titoloMese.toLowerCase()}</h3>
          {agenda.length === 0 ? (
            <EmptyState icon={<CalendarDays />} title="Nessuna attività nel mese" description="Non ci sono scadenze o assenze con i filtri selezionati." />
          ) : (
            <div className="space-y-4">
              {agenda.map((g) => (
                <div key={g.k}>
                  <Link href={`${base({ giorno: g.k })}#giorno`} className={cn("mb-1 block text-sm font-semibold", g.k === chiaveOggi ? "text-blue-700" : "text-slate-700")}>
                    {capitalize(formatDateLong(g.d))}
                    {g.k === chiaveOggi && " · oggi"}
                  </Link>
                  {g.assenze.length > 0 && (
                    <p className="mb-1 flex flex-wrap gap-1 text-xs text-purple-700">
                      {g.assenze.map((a) => (
                        <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5">
                          <Plane className="h-3 w-3" /> {a.user.nome} · {TIPI_ASSENZA[a.tipo as keyof typeof TIPI_ASSENZA] ?? a.tipo}
                          {a.stato === "RICHIESTA" ? " (in attesa)" : ""}
                        </span>
                      ))}
                    </p>
                  )}
                  {g.tasks.length > 0 && (
                    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                      {g.tasks.map((t) => (
                        <TaskRow key={t.id} task={t} userId={user.id} showDate={false} compact />
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {!giornoSel && (
        <p className="mt-4 hidden text-sm text-slate-500 md:block">Seleziona un giorno nel calendario per vedere le attività e le assenze di quel giorno.</p>
      )}
    </>
  );
}

function Legenda({ colore, children }: { colore: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", colore)} />
      {children}
    </span>
  );
}
