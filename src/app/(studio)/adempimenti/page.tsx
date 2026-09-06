import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, CalendarClock, ClipboardList, Eye, Pencil, Plus, Power } from "lucide-react";
import { prisma } from "@/lib/db";
import { isAdmin, requireStaff } from "@/lib/auth/guards";
import { CATEGORIE_ADEMPIMENTO, RICORRENZE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { PianificazioneMassivaForm } from "@/modules/adempimenti/PianificazioneMassivaForm";
import { ClientePicker } from "@/modules/adempimenti/ClientePicker";
import { toggleTemplateAttivo } from "@/modules/adempimenti/actions";
import { descriviApplicabilita, descriviScadenze } from "@/modules/adempimenti/descrivi";

export const metadata: Metadata = { title: "Adempimenti" };

export default async function AdempimentiPage(props: PageProps<"/adempimenti">) {
  const user = await requireStaff();
  const admin = isAdmin(user);
  const sp = await props.searchParams;
  const salvato = typeof sp.salvato === "string" ? sp.salvato : "";
  const anno = new Date().getFullYear();

  const [templates, conteggi, clienti] = await Promise.all([
    prisma.adempimentoTemplate.findMany({ orderBy: [{ ordine: "asc" }, { nome: "asc" }] }),
    prisma.task.groupBy({ by: ["templateId"], where: { anno, templateId: { not: null } }, _count: { _all: true } }),
    prisma.client.findMany({ where: { attivo: true }, select: { id: true, denominazione: true }, orderBy: { denominazione: "asc" } }),
  ]);
  const perTemplate = new Map(conteggi.map((c) => [c.templateId, c._count._all]));
  const categorie = Object.keys(CATEGORIE_ADEMPIMENTO) as (keyof typeof CATEGORIE_ADEMPIMENTO)[];
  const gruppi = categorie.map((cat) => ({ cat, items: templates.filter((t) => t.categoria === cat) })).filter((g) => g.items.length > 0);
  const altri = templates.filter((t) => !(t.categoria in CATEGORIE_ADEMPIMENTO));
  const attivi = templates.filter((t) => t.attivo).length;

  return (
    <>
      <PageHeader
        title="Adempimenti"
        description={`Catalogo di ${templates.length} adempimenti (${attivi} attivi): regole di scadenza e applicabilità usate per generare le attività dei clienti.`}
        actions={
          admin && (
            <Button href="/adempimenti/nuovo">
              <Plus className="h-4 w-4" /> Nuovo adempimento
            </Button>
          )
        }
      />

      {salvato && (
        <Alert kind="success" className="mb-4">
          Adempimento <strong>{salvato}</strong> salvato.
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Pianificazione massiva" description="Genera in un colpo solo le attività dell'anno per tutti i clienti attivi." />
          <CardBody>
            {admin ? (
              <PianificazioneMassivaForm annoCorrente={anno} nClienti={clienti.length} />
            ) : (
              <p className="text-sm text-slate-500">La pianificazione massiva è riservata agli amministratori. Puoi pianificare i singoli clienti dalla loro scheda, tab Attività.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Anteprima per un cliente" description="Verifica quali adempimenti si applicano a un cliente e genera le sue attività." />
          <CardBody className="space-y-3">
            {clienti.length ? <ClientePicker clienti={clienti} /> : <p className="text-sm text-slate-500">Nessun cliente attivo.</p>}
            <p className="text-xs text-slate-500">
              Nella scheda cliente puoi attivare o disattivare singoli adempimenti (anche quelli &ldquo;solo su richiesta&rdquo;) e vedere l&apos;anteprima delle scadenze.
            </p>
          </CardBody>
        </Card>
      </div>

      {templates.length === 0 ? (
        <EmptyState icon={<ClipboardList />} title="Catalogo vuoto" description="Non ci sono adempimenti: creane uno o esegui il seed del catalogo predefinito." />
      ) : (
        <div className="space-y-6">
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Categorie">
            {gruppi.map((g) => (
              <a key={g.cat} href={`#${g.cat}`} className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-300 hover:text-blue-700">
                {CATEGORIE_ADEMPIMENTO[g.cat]} <span className="text-slate-400">{g.items.length}</span>
              </a>
            ))}
          </nav>

          {[...gruppi, ...(altri.length ? [{ cat: "ALTRO" as const, items: altri }] : [])].map((g) => (
            <section key={g.cat} id={g.cat} className="scroll-mt-20">
              <h2 className="mb-2 text-base font-semibold text-slate-900">{CATEGORIE_ADEMPIMENTO[g.cat]}</h2>
              <ul className="space-y-3">
                {g.items.map((t) => {
                  const scadenze = descriviScadenze(t, anno);
                  const applicabilita = descriviApplicabilita(t);
                  const n = perTemplate.get(t.id) ?? 0;
                  return (
                    <li key={t.id}>
                      <Card className={cn(!t.attivo && "opacity-70")}>
                        <CardBody className="space-y-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-semibold text-slate-900">{t.nome}</h3>
                                <Badge color={t.attivo ? "green" : "slate"}>{t.attivo ? "Attivo" : "Disattivato"}</Badge>
                                <Badge color="blue">{RICORRENZE[t.ricorrenza as keyof typeof RICORRENZE] ?? t.ricorrenza}</Badge>
                                <span className="text-xs text-slate-400">{t.codice}</span>
                              </div>
                              {t.descrizione && <p className="mt-1 text-sm text-slate-600">{t.descrizione}</p>}
                            </div>
                            {admin && (
                              <div className="flex shrink-0 items-center gap-2">
                                <form action={toggleTemplateAttivo}>
                                  <input type="hidden" name="id" value={t.id} />
                                  <button type="submit" className={buttonClasses({ variant: "ghost", size: "sm" })} title={t.attivo ? "Disattiva" : "Attiva"}>
                                    <Power className={cn("h-4 w-4", t.attivo ? "text-green-600" : "text-slate-400")} />
                                    {t.attivo ? "Disattiva" : "Attiva"}
                                  </button>
                                </form>
                                <Button href={`/adempimenti/${t.id}`} variant="outline" size="sm">
                                  <Pencil className="h-4 w-4" /> Modifica
                                </Button>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                            <div className="rounded-lg bg-slate-50 px-3 py-2">
                              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                                <CalendarClock className="h-3.5 w-3.5" /> Scadenze {t.ricorrenza !== "MENSILE" && t.ricorrenza !== "UNA_TANTUM" ? `(esempio ${anno})` : ""}
                              </p>
                              <ul className="space-y-0.5 text-slate-700">
                                {scadenze.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            </div>
                            <div className="rounded-lg bg-slate-50 px-3 py-2">
                              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                                <Eye className="h-3.5 w-3.5" /> Si applica a
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {applicabilita.map((a) => (
                                  <Badge key={a.label} color={a.tono}>
                                    {a.label}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <BellRing className="h-3.5 w-3.5" /> Preavviso {t.giorniPreavviso} giorni
                            </span>
                            <Link href={`/attivita?template=${t.id}&anno=${anno}&stato=tutte`} className="hover:text-blue-700">
                              {n} attività generate nel {anno}
                            </Link>
                          </div>
                        </CardBody>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
