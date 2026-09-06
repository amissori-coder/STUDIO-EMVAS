import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Inbox, MailX, Settings } from "lucide-react";
import { requireStaff } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { isGoogleConfigured } from "@/lib/auth/google";
import { formatRelative } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { EmailAccountsBar } from "@/modules/email/SyncButton";
import { EmailFilters } from "@/modules/email/EmailFilters";
import { EmailRow } from "@/modules/email/EmailRow";
import { EMAIL_PAGE_SIZE, VISTE_EMAIL, listActiveClientsForSelect, listEmails, listGoogleAccounts, parseEmailFilters } from "@/modules/email/queries";

export const metadata: Metadata = { title: "Email" };

export default async function EmailPage(props: PageProps<"/email">) {
  const user = await requireStaff();
  const sp = await props.searchParams;
  const filters = parseEmailFilters(sp);

  const accounts = await listGoogleAccounts();
  if (accounts.length === 0) {
    const configured = isGoogleConfigured();
    const isAdmin = user.ruolo === "ADMIN";
    let description: string;
    if (configured) {
      description =
        "Per vedere qui le email dello studio, collega il tuo account Gmail dalla pagina Impostazioni: le email verranno importate e associate automaticamente ai clienti in base agli indirizzi.";
    } else if (isAdmin) {
      description =
        "L'integrazione Google non è configurata su questo server (mancano GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nel file .env). Una volta configurata, ogni collaboratore potrà collegare la propria casella Gmail dalle Impostazioni.";
    } else {
      description = "L'integrazione Gmail non è ancora attiva per lo studio: contatta l'amministratore.";
    }
    return (
      <>
        <PageHeader title="Email" description="Casella unificata delle email Gmail dello studio" />
        <EmptyState
          icon={<MailX />}
          title="Nessuna casella Gmail collegata"
          description={description}
          action={
            configured ? (
              <Button href="/impostazioni" variant="primary">
                <Settings className="h-4 w-4" /> Vai alle Impostazioni
              </Button>
            ) : undefined
          }
        />
      </>
    );
  }

  const [clienti, result, daAssociare] = await Promise.all([
    listActiveClientsForSelect(),
    listEmails(filters),
    prisma.emailMessage.count({ where: { clientId: null, archiviata: false } }),
  ]);

  const canSync = user.ruolo === "ADMIN" || accounts.some((a) => a.userId === user.id);
  const chips = accounts.map((a) => ({
    id: a.id,
    googleEmail: a.googleEmail,
    userName: a.user.nome,
    lastSyncLabel: a.lastSyncAt ? formatRelative(a.lastSyncAt) : null,
    syncError: a.syncError,
  }));

  const keep = new URLSearchParams();
  if (filters.cliente) keep.set("cliente", filters.cliente);
  if (filters.casella) keep.set("casella", filters.casella);
  if (filters.q) keep.set("q", filters.q);
  const hrefFor = (vista: string, pagina?: number) => {
    const p = new URLSearchParams(keep);
    p.set("vista", vista);
    if (pagina && pagina > 1) p.set("pagina", String(pagina));
    return `/email?${p.toString()}`;
  };

  const tabs = (Object.keys(VISTE_EMAIL) as (keyof typeof VISTE_EMAIL)[]).map((k) => ({
    key: k,
    label: VISTE_EMAIL[k],
    href: hrefFor(k),
    badge:
      k === "da-associare" && daAssociare > 0 ? (
        <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">{daAssociare}</span>
      ) : undefined,
  }));

  const first = (filters.pagina - 1) * EMAIL_PAGE_SIZE + 1;
  const last = Math.min(result.total, filters.pagina * EMAIL_PAGE_SIZE);
  const clienteSelezionato = filters.cliente ? clienti.find((c) => c.id === filters.cliente) : null;

  return (
    <>
      <PageHeader title="Email" description="Casella unificata: tutte le email delle caselle Gmail collegate dallo staff" />

      <div className="space-y-4">
        <EmailAccountsBar accounts={chips} canSync={canSync} />

        <Tabs items={tabs} param="vista" defaultKey="da-associare" />

        <EmailFilters
          vista={filters.vista}
          cliente={filters.cliente}
          casella={filters.casella}
          q={filters.q}
          clienti={clienti}
          caselle={accounts.map((a) => ({ id: a.id, googleEmail: a.googleEmail }))}
        />

        {clienteSelezionato && (
          <p className="text-sm text-slate-600">
            Email del cliente <Link href={`/clienti/${clienteSelezionato.id}`} className="font-medium text-blue-700 hover:underline">{clienteSelezionato.denominazione}</Link>
          </p>
        )}

        {result.items.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title={filters.q || filters.cliente || filters.casella ? "Nessuna email corrisponde ai filtri" : VUOTE[filters.vista]}
            description={
              filters.vista === "da-associare" && !filters.q && !filters.cliente
                ? "Tutte le email importate sono già associate a un cliente o archiviate. Usa “Sincronizza ora” per importare le più recenti."
                : undefined
            }
          />
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {result.items.map((e) => (
                <EmailRow key={e.id} email={e} showAccount={accounts.length > 1} />
              ))}
            </ul>
          </Card>
        )}

        {result.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
            <span>
              {first}–{last} di {result.total}
            </span>
            {result.pages > 1 && (
              <div className="flex items-center gap-1">
                <Button href={hrefFor(filters.vista, Math.max(1, filters.pagina - 1))} variant="outline" size="sm" className={filters.pagina <= 1 ? "pointer-events-none opacity-50" : undefined}>
                  <ChevronLeft className="h-4 w-4" /> Precedente
                </Button>
                <span className="px-2">
                  Pagina {filters.pagina} di {result.pages}
                </span>
                <Button href={hrefFor(filters.vista, Math.min(result.pages, filters.pagina + 1))} variant="outline" size="sm" className={filters.pagina >= result.pages ? "pointer-events-none opacity-50" : undefined}>
                  Successiva <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

const VUOTE: Record<keyof typeof VISTE_EMAIL, string> = {
  "da-associare": "Nessuna email da associare",
  tutte: "Nessuna email importata",
  "con-allegati": "Nessuna email con allegati",
  archiviate: "Nessuna email archiviata",
};
