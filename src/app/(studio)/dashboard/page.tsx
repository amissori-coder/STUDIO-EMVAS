import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarOff,
  CalendarRange,
  ClipboardList,
  FileUp,
  Inbox,
  ListChecks,
  Mail,
  MessageSquare,
  Sun,
  UserRoundX,
  type LucideIcon,
} from "lucide-react";
import { requireStaff } from "@/lib/auth/guards";
import { TIPI_ASSENZA } from "@/lib/constants";
import { cn, formatDate, formatDateLong, formatRelative } from "@/lib/utils";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, TIPO_ASSENZA_COLOR } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { loadDashboard, type DashTask } from "@/modules/team/dashboard";
import { DashTaskRow } from "./DashTaskRow";

export const metadata: Metadata = { title: "Dashboard" };

function capitalizza(s: string) {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function saluto(d: Date) {
  const h = d.getHours();
  if (h < 6) return "Buonanotte";
  if (h < 13) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

function Kpi({
  label,
  value,
  sub,
  href,
  icon: Icon,
  tone = "slate",
}: {
  label: string;
  value: number;
  sub?: string;
  href: string;
  icon: LucideIcon;
  tone?: "slate" | "red" | "amber" | "blue" | "teal" | "purple" | "yellow";
}) {
  const tones = {
    slate: "text-slate-600 bg-slate-100",
    red: "text-red-600 bg-red-50",
    amber: "text-amber-600 bg-amber-50",
    blue: "text-blue-600 bg-blue-50",
    teal: "text-teal-600 bg-teal-50",
    purple: "text-purple-600 bg-purple-50",
    yellow: "text-yellow-700 bg-yellow-50",
  };
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-blue-300 sm:p-4">
      <span className={cn("hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:inline-flex", tones[tone])}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className={cn("text-2xl font-semibold leading-tight", value > 0 && tone !== "slate" ? tones[tone].split(" ")[0] : "text-slate-900")}>{value}</p>
        <p className="truncate text-xs text-slate-500">{label}</p>
        {sub && <p className="truncate text-[11px] text-slate-400">{sub}</p>}
      </div>
    </Link>
  );
}

function raggruppaPerGiorno(tasks: DashTask[]) {
  const map = new Map<string, { label: string; items: DashTask[] }>();
  for (const t of tasks) {
    const key = formatDate(t.scadenza, "yyyy-MM-dd");
    if (!map.has(key)) map.set(key, { label: formatDate(t.scadenza, "EEEE d MMMM"), items: [] });
    map.get(key)!.items.push(t);
  }
  return Array.from(map.values());
}

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const user = await requireStaff();
  const sp = await props.searchParams;
  const isAdmin = user.ruolo === "ADMIN";
  const d = await loadDashboard(user);
  const now = new Date();
  const nomeBreve = user.nome.split(/\s+/)[0] ?? user.nome;

  return (
    <>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          {saluto(now)}, {nomeBreve}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{capitalizza(formatDateLong(now))}</p>
      </div>

      {sp.errore === "solo-admin" && (
        <Alert kind="warning" className="mb-4">
          La pagina richiesta è riservata agli amministratori.
        </Alert>
      )}

      {d.pianificazioneMancante && (
        <Alert kind="info" className="mb-4" title={`Nessun adempimento pianificato per il ${d.oggi.getFullYear()}`}>
          <p>Genera le scadenze fiscali dell&apos;anno per tutti i clienti con la pianificazione massiva.</p>
          <Link href="/adempimenti" className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
            Vai agli adempimenti <ArrowRight className="h-4 w-4" />
          </Link>
        </Alert>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Kpi label="Attività scadute" value={d.kpi.scaduteMie} sub={`${d.kpi.scaduteTotali} in tutto lo studio`} href="/attivita?assegnatario=me&stato=aperte&periodo=scadute&ordina=scadenza" icon={AlertTriangle} tone="red" />
        <Kpi label="In scadenza oggi" value={d.kpi.oggiMie} sub={`${d.kpi.oggiTotali} in tutto lo studio`} href="/attivita?assegnatario=me&stato=aperte&periodo=oggi&ordina=scadenza" icon={Sun} tone="amber" />
        <Kpi label="Prossimi 7 giorni" value={d.kpi.settimanaMie} sub={`${d.kpi.settimanaTotali} in tutto lo studio`} href="/attivita?assegnatario=me&stato=aperte&periodo=settimana&ordina=scadenza" icon={CalendarRange} tone="blue" />
        <Kpi label="Email da associare" value={d.kpi.emailDaAssociare} href="/email?vista=da-associare" icon={Inbox} tone="teal" />
        <Kpi label="Chat con messaggi nuovi" value={d.kpi.chatNonLette} href="/chat" icon={MessageSquare} tone="purple" />
        <Kpi label="Documenti dai clienti" value={d.kpi.documentiClienti7g} sub="ultimi 7 giorni" href="/clienti" icon={FileUp} tone="teal" />
        {isAdmin && <Kpi label="Assenze da approvare" value={d.kpi.assenzeInAttesa} href="/team/assenze?stato=RICHIESTA" icon={CalendarClock} tone="yellow" />}
        {isAdmin && (
          <Link href="/adempimenti" className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3 text-sm text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700 sm:p-4">
            <ClipboardList className="hidden h-5 w-5 shrink-0 sm:block" />
            <span>
              Adempimenti e<br className="hidden sm:block" /> pianificazione annuale
            </span>
          </Link>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Colonna principale */}
        <div className="space-y-5 lg:col-span-3">
          <Card>
            <CardHeader
              title="Le mie attività"
              description="Scadute e in scadenza nei prossimi 7 giorni."
              actions={
                <Button href="/attivita?assegnatario=me&stato=aperte&ordina=scadenza" variant="ghost" size="sm">
                  Tutte <ArrowRight className="h-4 w-4" />
                </Button>
              }
            />
            {d.mieAttivita.length === 0 ? (
              <CardBody>
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <ListChecks className="h-4 w-4 text-green-600" /> Nessuna attività urgente assegnata a te. Ottimo lavoro!
                </p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.mieAttivita.map((t) => (
                  <DashTaskRow key={t.id} task={t} quickComplete />
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Prossime scadenze dello studio"
              description={`${d.prossimeScadenzeTotale} ${d.prossimeScadenzeTotale === 1 ? "attività aperta" : "attività aperte"} nei prossimi 7 giorni.`}
              actions={
                <Button href="/attivita?stato=aperte&periodo=settimana&ordina=scadenza" variant="ghost" size="sm">
                  Tutte <ArrowRight className="h-4 w-4" />
                </Button>
              }
            />
            {d.prossimeScadenze.length === 0 ? (
              <CardBody>
                <p className="text-sm text-slate-500">Nessuna scadenza nei prossimi 7 giorni.</p>
              </CardBody>
            ) : (
              <div className="divide-y divide-slate-100">
                {raggruppaPerGiorno(d.prossimeScadenze).map((g) => (
                  <section key={g.label}>
                    <h3 className="bg-slate-50 px-3 py-1.5 text-xs font-semibold capitalize text-slate-600 sm:px-4">{g.label}</h3>
                    <ul className="divide-y divide-slate-100">
                      {g.items.map((t) => (
                        <DashTaskRow key={t.id} task={t} showAssignee />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Colonna laterale */}
        <div className="space-y-5 lg:col-span-2">
          {d.allerte.length > 0 && (
            <Card className="border-orange-200">
              <CardHeader
                title={
                  <span className="inline-flex items-center gap-2 text-orange-800">
                    <UserRoundX className="h-5 w-5" /> Allerta assenze
                  </span>
                }
                description="Colleghi assenti con attività in scadenza: valuta la riassegnazione."
              />
              <ul className="divide-y divide-slate-100">
                {d.allerte.map(({ assenza, tasks, totale }) => (
                  <li key={assenza.id} className="px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-2">
                      <Avatar nome={assenza.user.nome} colore={assenza.user.colore} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{assenza.user.nome}</p>
                        <p className="text-xs text-slate-500">
                          {TIPI_ASSENZA[assenza.tipo as keyof typeof TIPI_ASSENZA] ?? assenza.tipo} dal {formatDate(assenza.dataInizio)} al {formatDate(assenza.dataFine)}
                        </p>
                      </div>
                      <Badge color="orange">{totale} attività</Badge>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                      {tasks.map((t) => (
                        <li key={t.id} className="flex items-center gap-2">
                          <span className={cn("shrink-0 font-medium", t.scadenza < d.oggi ? "text-red-600" : "text-slate-500")}>{formatDate(t.scadenza)}</span>
                          <Link href={`/attivita/${t.id}`} className="min-w-0 truncate hover:text-blue-700">
                            {t.titolo}
                            {t.client ? ` (${t.client.denominazione})` : ""}
                          </Link>
                        </li>
                      ))}
                      {totale > tasks.length && <li className="text-slate-400">…e altre {totale - tasks.length}</li>}
                    </ul>
                    <Link
                      href={`/attivita?assegnatario=${assenza.userId}&stato=aperte&ordina=scadenza`}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-orange-800 hover:underline"
                    >
                      Riassegna le attività <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Chi è assente questa settimana"
              actions={
                <Button href="/team/assenze" variant="ghost" size="sm">
                  Assenze <ArrowRight className="h-4 w-4" />
                </Button>
              }
            />
            <CardBody>
              {d.assentiSettimana.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <CalendarOff className="h-4 w-4 text-slate-400" /> Nessuna assenza approvata nei prossimi 7 giorni.
                </p>
              ) : (
                <ul className="space-y-2">
                  {d.assentiSettimana.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 text-sm">
                      <Avatar nome={a.user.nome} colore={a.user.colore} size="xs" />
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{a.user.nome}</span>
                      <Badge color={TIPO_ASSENZA_COLOR[a.tipo]}>{TIPI_ASSENZA[a.tipo as keyof typeof TIPI_ASSENZA] ?? a.tipo}</Badge>
                      <span className="shrink-0 text-xs text-slate-500">
                        {formatDate(a.dataInizio, "d/M")} – {formatDate(a.dataFine, "d/M")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Ultime email da clienti"
              actions={
                <Button href="/email" variant="ghost" size="sm">
                  Email <ArrowRight className="h-4 w-4" />
                </Button>
              }
            />
            {d.ultimeEmail.length === 0 ? (
              <CardBody>
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <Mail className="h-4 w-4 text-slate-400" /> Nessuna email associata a clienti.
                </p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.ultimeEmail.map((e) => (
                  <li key={e.id}>
                    <Link href={`/email/${e.id}`} className="block px-4 py-2.5 hover:bg-slate-50 sm:px-5">
                      <p className="truncate text-sm font-medium text-slate-900">{e.subject || "(senza oggetto)"}</p>
                      <p className="truncate text-xs text-slate-500">
                        {e.fromName || e.fromAddr}
                        {e.client ? ` · ${e.client.denominazione}` : ""} · {formatRelative(e.receivedAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Ultimi documenti dai clienti" />
            {d.ultimiDocumenti.length === 0 ? (
              <CardBody>
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <FileUp className="h-4 w-4 text-slate-400" /> Nessun documento caricato dai clienti.
                </p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-slate-100">
                {d.ultimiDocumenti.map((doc) => (
                  <li key={doc.id}>
                    <Link href={`/clienti/${doc.client.id}?tab=documenti`} className="block px-4 py-2.5 hover:bg-slate-50 sm:px-5">
                      <p className="truncate text-sm font-medium text-slate-900">{doc.nome}</p>
                      <p className="truncate text-xs text-slate-500">
                        {doc.client.denominazione}
                        {doc.uploadedBy ? ` · ${doc.uploadedBy.nome}` : ""} · {formatRelative(doc.createdAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
