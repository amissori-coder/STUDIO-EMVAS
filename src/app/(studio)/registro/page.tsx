import type { Metadata } from "next";
import Link from "next/link";
import { History, KeyRound, UserX } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { AZIONI, CAMPI, CAMPI_CLIENTE, CAMPI_GIORNO, CAMPI_PERSONA, CODICI, ENTITA, GRUPPI, azioniDelGruppo, differenze, etichettaAzione } from "@/modules/registro/etichette";
import { caricaRegistro, leggiFiltri, personePerFiltro, REGISTRO_PAGE_SIZE, type FiltriRegistro } from "@/modules/registro/queries";

export const metadata: Metadata = { title: "Registro operazioni" };

/** Un valore dei dettagli in italiano: nomi al posto degli identificativi, date leggibili. */
function valore(campo: string, v: unknown, nomi: Record<string, string>): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "sì" : "no";
  if (typeof v === "string" && nomi[v]) return nomi[v];
  if (typeof v === "string" && (CAMPI_PERSONA.has(campo) || CAMPI_CLIENTE.has(campo))) return "non più presente";
  if (typeof v === "string" && CODICI[v]) return CODICI[v];
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return CAMPI_GIORNO.has(campo) ? formatDate(v) : formatDateTime(v);
  if (Array.isArray(v)) return v.map((x) => valore(campo, x, nomi)).join(", ");
  if (typeof v === "object")
    return Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => `${CAMPI[k] ?? k}: ${valore(k, x, nomi)}`)
      .join(" · ");
  return String(v);
}

function href(f: FiltriRegistro, cambi: Partial<FiltriRegistro>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...cambi })) {
    if (k === "pagina" ? Number(v) > 1 : v) p.set(k, String(v));
  }
  const q = p.toString();
  return q ? `/registro?${q}` : "/registro";
}

export default async function RegistroPage(props: PageProps<"/registro">) {
  await requireAdmin();
  const f = leggiFiltri(await props.searchParams);
  const [{ righe, totale, pagine, pagina, nomi }, persone] = await Promise.all([caricaRegistro(f), personePerFiltro()]);
  const filtrato = Object.entries(f).some(([k, v]) => k !== "pagina" && v);
  const azioniFiltro = f.gruppo ? azioniDelGruppo(f.gruppo) : Object.keys(AZIONI);

  return (
    <>
      <PageHeader
        title="Registro operazioni"
        description="Chi ha fatto che cosa e quando, dalla più recente. Le righe non si possono modificare né cancellare."
      />

      <Card className="mb-4 p-4">
        <form method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-slate-600">
            Persona
            <Select name="persona" defaultValue={f.persona} className="mt-1">
              <option value="">Chiunque</option>
              <option value="nessuno">Tentativi di accesso e account eliminati</option>
              {persone.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                  {p.attivo ? "" : " (disattivato)"}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Ambito
            <Select name="gruppo" defaultValue={f.gruppo} className="mt-1">
              <option value="">Tutti gli ambiti</option>
              {Object.entries(GRUPPI).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Operazione
            <Select name="azione" defaultValue={f.azione} className="mt-1">
              <option value="">Tutte le operazioni</option>
              {azioniFiltro.map((a) => (
                <option key={a} value={a}>
                  {etichettaAzione(a).label}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Cerca nei dettagli
            <Input name="q" defaultValue={f.q} placeholder="Nome, email, cliente…" className="mt-1" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Dal giorno
            <Input type="date" name="da" defaultValue={f.da} className="mt-1" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Al giorno
            <Input type="date" name="a" defaultValue={f.a} className="mt-1" />
          </label>
          {f.entita && <input type="hidden" name="entita" value={f.entita} />}
          {f.oggetto && <input type="hidden" name="oggetto" value={f.oggetto} />}
          <div className="flex items-end gap-2 sm:col-span-2">
            <button type="submit" className={buttonClasses({ variant: "primary", size: "md" })}>
              Filtra
            </button>
            {filtrato && (
              <Link href="/registro" className={buttonClasses({ variant: "ghost", size: "md" })}>
                Togli i filtri
              </Link>
            )}
          </div>
        </form>
        {f.oggetto && (
          <p className="mt-3 text-xs text-slate-500">
            Solo le operazioni su un oggetto ({ENTITA[f.entita] ?? f.entita}).{" "}
            <Link href={href(f, { entita: "", oggetto: "", pagina: 1 })} className="text-blue-700 hover:underline">
              Mostra tutte
            </Link>
          </p>
        )}
      </Card>

      {righe.length === 0 ? (
        <EmptyState
          icon={<History />}
          title={filtrato ? "Nessuna operazione corrisponde ai filtri" : "Il registro è vuoto"}
          description={filtrato ? "Allarga il periodo o togli qualche filtro." : "Le operazioni compariranno qui man mano che vengono eseguite."}
        />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {righe.map((r) => {
              const az = etichettaAzione(r.azione);
              const dati = r.dettagli.dati;
              const modifiche = differenze(dati);
              const altriDati = dati && modifiche ? Object.fromEntries(Object.entries(dati).filter(([k]) => k !== "prima" && k !== "dopo")) : dati;
              const emailTentativo = r.autore.tipo === "tentativo" && typeof dati?.email === "string" ? dati.email : null;
              return (
                <li key={r.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
                  <time className="shrink-0 text-xs text-slate-500 sm:w-32" dateTime={r.createdAt.toISOString()}>
                    {formatDateTime(r.createdAt)}
                  </time>
                  <div className="flex shrink-0 items-center gap-2 sm:w-48">
                    {r.autore.tipo === "persona" ? (
                      <>
                        <Avatar nome={r.autore.nome} colore={r.autore.colore} size="sm" />
                        <span className="truncate text-sm text-slate-800">{r.autore.nome}</span>
                      </>
                    ) : r.autore.tipo === "tentativo" ? (
                      <>
                        <KeyRound className="h-4 w-4 shrink-0 text-amber-600" />
                        <span className="truncate text-sm text-slate-800" title={emailTentativo ?? undefined}>
                          {emailTentativo ? `Accesso come ${emailTentativo}` : "Tentativo di accesso"}
                        </span>
                      </>
                    ) : (
                      <>
                        <UserX className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="text-sm italic text-slate-500">Account eliminato</span>
                      </>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Badge color={az.colore}>{az.label}</Badge>
                    {r.oggetto && !r.oggetto.etichetta && (
                      <p className="mt-1 text-sm italic text-slate-400">{ENTITA[r.entita] ?? r.entita} non più presente</p>
                    )}
                    {r.oggetto?.etichetta && (
                      <p className="mt-1 text-sm text-slate-600">
                        {ENTITA[r.entita] ?? r.entita}:{" "}
                        {r.oggetto.href ? (
                          <Link href={r.oggetto.href} className="font-medium text-blue-700 hover:underline">
                            {r.oggetto.etichetta}
                          </Link>
                        ) : (
                          <span className="font-medium">{r.oggetto.etichetta}</span>
                        )}
                        {r.oggetto.rimosso && <span className="ml-1 text-xs italic text-slate-400">non più presente</span>}
                      </p>
                    )}
                    {(dati || r.dettagli.grezzo) && (
                      <details className="mt-1 text-xs text-slate-600">
                        <summary className="cursor-pointer select-none text-slate-500">Dettagli</summary>
                        {dati ? (
                          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                            {modifiche?.length === 0 && (
                              <div className="contents">
                                <dt className="text-slate-400">Modifiche</dt>
                                <dd>nessun campo principale cambiato</dd>
                              </div>
                            )}
                            {modifiche?.map((m) => (
                              <div key={`m-${m.campo}`} className="contents">
                                <dt className="text-slate-400">{CAMPI[m.campo] ?? m.campo}</dt>
                                <dd className="break-words">
                                  {valore(m.campo, m.prima, nomi)} → {valore(m.campo, m.dopo, nomi)}
                                </dd>
                              </div>
                            ))}
                            {Object.entries(altriDati ?? {}).map(([k, v]) => (
                              <div key={k} className="contents">
                                <dt className="text-slate-400">{CAMPI[k] ?? k}</dt>
                                <dd className="break-words">{valore(k, v, nomi)}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <>
                            <p className="mt-1 text-slate-400">
                              {r.dettagli.troncati ? "I dettagli sono stati accorciati al salvataggio: ecco il testo registrato." : "Testo registrato:"}
                            </p>
                            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2">{r.dettagli.grezzo}</pre>
                          </>
                        )}
                        <p className="mt-1 text-slate-400">Codice dell&apos;operazione: {r.azione}</p>
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
            <span>
              {(pagina - 1) * REGISTRO_PAGE_SIZE + 1}–{Math.min(pagina * REGISTRO_PAGE_SIZE, totale)} di{" "}
              {totale === 1 ? "1 operazione" : `${totale} operazioni`}
            </span>
            <div className="flex items-center gap-2">
              {pagina > 1 && (
                <Link href={href(f, { pagina: pagina - 1 })} className={buttonClasses({ variant: "outline", size: "sm" })}>
                  Più recenti
                </Link>
              )}
              <span>
                Pagina {pagina} di {pagine}
              </span>
              {pagina < pagine && (
                <Link href={href(f, { pagina: pagina + 1 })} className={buttonClasses({ variant: "outline", size: "sm" })}>
                  Più vecchie
                </Link>
              )}
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
