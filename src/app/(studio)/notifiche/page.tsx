import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BellOff, Check, CheckCheck, ExternalLink, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guards";
import { TIPI_NOTIFICA } from "@/lib/constants";
import { cn, formatDateTime, formatRelative } from "@/lib/utils";
import { Alert } from "@/components/ui/Alert";
import { Button, buttonClasses } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { NotificationIcon } from "@/modules/notifiche/NotificationIcon";
import { deleteOldReadNotificationsFormAction, markAllNotificationsReadFormAction, markNotificationReadFormAction } from "@/modules/notifiche/actions";

export const metadata: Metadata = { title: "Notifiche" };

const PAGE_SIZE = 50;

function str(v: string | string[] | undefined) {
  return typeof v === "string" ? v : "";
}

function isInternalLink(link: string | null) {
  return !!link && link.startsWith("/") && !link.startsWith("//");
}

export default async function NotifichePage(props: PageProps<"/notifiche">) {
  const user = await requireStaff();
  const sp = await props.searchParams;
  const vista = str(sp.vista) === "tutte" ? "tutte" : "non-lette";
  const pagina = Math.max(1, Number.parseInt(str(sp.pagina) || "1", 10) || 1);
  const messaggio = str(sp.messaggio);
  const errore = str(sp.errore);
  const n = Number.parseInt(str(sp.n) || "0", 10) || 0;

  const where = { userId: user.id, ...(vista === "non-lette" ? { letta: null } : {}) };
  const [notifiche, totale, nonLette] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (pagina - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: user.id, letta: null } }),
  ]);
  const pagine = Math.max(1, Math.ceil(totale / PAGE_SIZE));
  const query = (p: number) => `/notifiche?vista=${vista}${p > 1 ? `&pagina=${p}` : ""}`;

  return (
    <>
      <PageHeader
        title="Notifiche"
        description={nonLette === 0 ? "Nessuna notifica da leggere." : `${nonLette} ${nonLette === 1 ? "notifica non letta" : "notifiche non lette"}.`}
        actions={
          <>
            {nonLette > 0 && (
              <form action={markAllNotificationsReadFormAction}>
                <Button type="submit" variant="outline">
                  <CheckCheck className="h-4 w-4" /> Segna tutte come lette
                </Button>
              </form>
            )}
            <form action={deleteOldReadNotificationsFormAction}>
              <ConfirmButton message="Eliminare le notifiche già lette più vecchie di 30 giorni?" variant="ghost">
                <Trash2 className="h-4 w-4" /> Pulisci vecchie
              </ConfirmButton>
            </form>
          </>
        }
      />

      {messaggio === "pulite" && (
        <Alert kind="success" className="mb-4">
          {n === 0 ? "Nessuna notifica da eliminare: non ci sono notifiche lette più vecchie di 30 giorni." : `Eliminate ${n} ${n === 1 ? "notifica" : "notifiche"} lette più vecchie di 30 giorni.`}
        </Alert>
      )}
      {errore === "pulizia" && (
        <Alert kind="error" className="mb-4">
          Errore durante la pulizia delle notifiche.
        </Alert>
      )}

      <Tabs
        className="mb-4"
        param="vista"
        defaultKey="non-lette"
        items={[
          {
            key: "non-lette",
            label: "Non lette",
            href: "/notifiche?vista=non-lette",
            badge: nonLette > 0 ? <span className="rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">{nonLette > 99 ? "99+" : nonLette}</span> : undefined,
          },
          { key: "tutte", label: "Tutte", href: "/notifiche?vista=tutte" },
        ]}
      />

      {notifiche.length === 0 ? (
        <EmptyState
          icon={vista === "non-lette" ? <BellOff /> : <Bell />}
          title={vista === "non-lette" ? "Sei in pari: nessuna notifica da leggere" : "Nessuna notifica"}
          description={vista === "non-lette" ? "Le notifiche già lette restano disponibili nella sezione “Tutte”." : "Qui compariranno gli avvisi su attività, scadenze, email, chat e assenze."}
          action={vista === "non-lette" && totale === 0 ? <Button href="/notifiche?vista=tutte" variant="outline">Vedi tutte</Button> : undefined}
        />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {notifiche.map((nt) => {
            const nonLetta = !nt.letta;
            const apri = isInternalLink(nt.link) ? `/api/notifiche/${nt.id}/apri` : null;
            const tipoLabel = TIPI_NOTIFICA[nt.tipo as keyof typeof TIPI_NOTIFICA] ?? nt.tipo;
            return (
              <li key={nt.id} className={cn("flex gap-3 px-3 py-3 sm:px-4", nonLetta ? "bg-blue-50/60" : "bg-white")}>
                <NotificationIcon tipo={nt.tipo} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{tipoLabel}</p>
                      {apri ? (
                        <a href={apri} className={cn("block text-sm text-slate-900 hover:text-blue-700", nonLetta ? "font-semibold" : "font-medium")}>
                          {nt.titolo}
                        </a>
                      ) : (
                        <p className={cn("text-sm text-slate-900", nonLetta ? "font-semibold" : "font-medium")}>{nt.titolo}</p>
                      )}
                    </div>
                    {nonLetta && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" aria-label="Non letta" />}
                  </div>
                  {nt.corpo && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{nt.corpo}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <time dateTime={nt.createdAt.toISOString()} title={formatDateTime(nt.createdAt)} className="text-xs text-slate-400">
                      {formatRelative(nt.createdAt)}
                    </time>
                    {apri && (
                      <a href={apri} className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" /> Apri
                      </a>
                    )}
                    {nonLetta && (
                      <form action={markNotificationReadFormAction} className="ml-auto sm:ml-0">
                        <input type="hidden" name="id" value={nt.id} />
                        <button type="submit" className={buttonClasses({ variant: "ghost", size: "sm", className: "h-9 sm:h-7 text-xs" })}>
                          <Check className="h-3.5 w-3.5" /> Segna come letta
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totale > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <p>
            {(pagina - 1) * PAGE_SIZE + 1}–{Math.min(pagina * PAGE_SIZE, totale)} di {totale}
          </p>
          {pagine > 1 && (
            <div className="flex items-center gap-2">
              {pagina > 1 && (
                <Link href={query(pagina - 1)} className={buttonClasses({ variant: "outline", size: "sm" })}>
                  Più recenti
                </Link>
              )}
              <span>
                Pagina {pagina} di {pagine}
              </span>
              {pagina < pagine && (
                <Link href={query(pagina + 1)} className={buttonClasses({ variant: "outline", size: "sm" })}>
                  Più vecchie
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
