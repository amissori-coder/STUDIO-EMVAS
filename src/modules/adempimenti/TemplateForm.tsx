"use client";
import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { CATEGORIE_ADEMPIMENTO, REGIMI_FISCALI, RICORRENZE, TIPI_SOGGETTO } from "@/lib/constants";
import { MESI } from "@/lib/adempimenti/calendario";
import type { ScadenzaFissa, ScadenzaMensile } from "@/lib/adempimenti/catalogo";
import { salvaTemplate, type TemplateActionResult } from "@/modules/adempimenti/actions";
import { parseScadenze } from "@/modules/adempimenti/descrivi";

export interface TemplateFormValues {
  id?: string;
  codice: string;
  nome: string;
  descrizione: string | null;
  categoria: string;
  ricorrenza: string;
  scadenze: string;
  regimi: string[];
  tipiSoggetto: string[];
  soloConDipendenti: boolean | null;
  soloConIva: boolean | null;
  periodicitaIva: string | null;
  soloSuRichiesta: boolean;
  giorniPreavviso: number;
  attivo: boolean;
  ordine: number;
}

type RigaFissa = { mese: number; giorno: number; etichetta: string };

function triValore(v: boolean | null) {
  return v === null ? "" : v ? "si" : "no";
}

function slugCodice(nome: string) {
  return nome
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .slice(0, 40);
}

export function TemplateForm({ valori }: { valori: TemplateFormValues }) {
  const [state, action] = useActionState<TemplateActionResult, FormData>(salvaTemplate, {});
  const iniziali = parseScadenze(valori.scadenze);
  const [ricorrenza, setRicorrenza] = useState(valori.ricorrenza);
  const [mensile, setMensile] = useState<{ giorno: number; offset: number }>(() => {
    const r = (valori.ricorrenza === "MENSILE" ? iniziali[0] : undefined) as ScadenzaMensile | undefined;
    return { giorno: r?.giorno ?? 16, offset: r?.offsetMeseCompetenza ?? -1 };
  });
  const [fisse, setFisse] = useState<RigaFissa[]>(() => {
    const rows = valori.ricorrenza !== "MENSILE" ? (iniziali as ScadenzaFissa[]).filter((r) => typeof r.mese === "number") : [];
    return rows.length ? rows.map((r) => ({ mese: r.mese, giorno: r.giorno, etichetta: r.etichetta ?? "" })) : [{ mese: 6, giorno: 30, etichetta: "Anno {annoPrec}" }];
  });
  const [codice, setCodice] = useState(valori.codice);
  const [codiceModificato, setCodiceModificato] = useState(!!valori.codice);

  const scadenzeJson =
    ricorrenza === "MENSILE"
      ? JSON.stringify([{ giorno: mensile.giorno, offsetMeseCompetenza: mensile.offset }])
      : ricorrenza === "UNA_TANTUM"
        ? "[]"
        : JSON.stringify(fisse.map((r) => ({ mese: r.mese, giorno: r.giorno, ...(r.etichetta.trim() ? { etichetta: r.etichetta.trim() } : {}) })));

  function aggiornaRiga(i: number, patch: Partial<RigaFissa>) {
    setFisse((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  return (
    <form action={action} className="space-y-6">
      {valori.id && <input type="hidden" name="id" value={valori.id} />}
      <input type="hidden" name="scadenze" value={scadenzeJson} />
      {state.error && <Alert kind="error">{state.error}</Alert>}

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Dati generali</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome *" htmlFor="nome" className="sm:col-span-2">
            <Input
              id="nome"
              name="nome"
              required
              maxLength={200}
              defaultValue={valori.nome}
              onChange={(e) => {
                if (!codiceModificato) setCodice(slugCodice(e.target.value));
              }}
              placeholder="Es. Liquidazione e versamento IVA mensile"
            />
          </Field>
          <Field label="Codice *" htmlFor="codice" hint="Identificativo univoco (maiuscole, numeri, _).">
            <Input
              id="codice"
              name="codice"
              required
              value={codice}
              onChange={(e) => {
                setCodice(e.target.value.toUpperCase());
                setCodiceModificato(true);
              }}
              pattern="[A-Z0-9_]+"
              maxLength={60}
            />
          </Field>
          <Field label="Categoria *" htmlFor="categoria">
            <Select id="categoria" name="categoria" defaultValue={valori.categoria || "ALTRO"}>
              {Object.entries(CATEGORIE_ADEMPIMENTO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Descrizione" htmlFor="descrizione" className="sm:col-span-2">
            <Textarea id="descrizione" name="descrizione" defaultValue={valori.descrizione ?? ""} rows={3} placeholder="Cosa prevede l'adempimento, riferimenti normativi, note operative…" />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Scadenze</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Ricorrenza *" htmlFor="ricorrenza">
            <Select id="ricorrenza" name="ricorrenza" value={ricorrenza} onChange={(e) => setRicorrenza(e.target.value)}>
              {Object.entries(RICORRENZE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Giorni di preavviso" htmlFor="giorniPreavviso" hint="Promemoria all'assegnatario N giorni prima della scadenza.">
            <Input id="giorniPreavviso" name="giorniPreavviso" type="number" min={0} max={365} defaultValue={valori.giorniPreavviso} />
          </Field>
        </div>

        {ricorrenza === "MENSILE" && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm text-slate-600">Una scadenza ogni mese dell&apos;anno (12 attività). Se cade di sabato, domenica o festivo viene spostata al primo giorno lavorativo.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Giorno del mese" htmlFor="m-giorno" hint="0 = ultimo giorno del mese.">
                <Input id="m-giorno" type="number" min={0} max={31} value={mensile.giorno} onChange={(e) => setMensile((m) => ({ ...m, giorno: Number(e.target.value) || 0 }))} />
              </Field>
              <Field label="Mese di competenza" htmlFor="m-offset" hint="Usato per l'etichetta del periodo (es. “Liquidazione IVA – Gennaio”).">
                <Select id="m-offset" value={mensile.offset} onChange={(e) => setMensile((m) => ({ ...m, offset: Number(e.target.value) }))}>
                  <option value={0}>Stesso mese della scadenza</option>
                  <option value={-1}>Mese precedente</option>
                  <option value={-2}>Due mesi prima</option>
                  <option value={-3}>Tre mesi prima</option>
                </Select>
              </Field>
            </div>
          </div>
        )}

        {(ricorrenza === "ANNUALE" || ricorrenza === "TRIMESTRALE") && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm text-slate-600">
              Una riga per ogni scadenza dell&apos;anno. Giorno 0 = ultimo giorno del mese. Nell&apos;etichetta puoi usare <code className="rounded bg-white px-1">{"{anno}"}</code> e{" "}
              <code className="rounded bg-white px-1">{"{annoPrec}"}</code>.
            </p>
            <div className="space-y-2">
              {fisse.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_5rem_2.5rem] items-end gap-2 sm:grid-cols-[10rem_5rem_1fr_2.5rem]">
                  <label className="text-xs font-medium text-slate-600">
                    Mese
                    <Select value={r.mese} onChange={(e) => aggiornaRiga(i, { mese: Number(e.target.value) })} className="mt-1">
                      {MESI.map((m, idx) => (
                        <option key={m} value={idx + 1}>
                          {m.charAt(0).toUpperCase() + m.slice(1)}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Giorno
                    <Input type="number" min={0} max={31} value={r.giorno} onChange={(e) => aggiornaRiga(i, { giorno: Number(e.target.value) || 0 })} className="mt-1" />
                  </label>
                  <label className="col-span-2 text-xs font-medium text-slate-600 sm:col-span-1">
                    Etichetta periodo
                    <Input value={r.etichetta} onChange={(e) => aggiornaRiga(i, { etichetta: e.target.value })} placeholder="Es. Anno {annoPrec}" maxLength={80} className="mt-1" />
                  </label>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setFisse((rows) => rows.filter((_, idx) => idx !== i))} disabled={fisse.length <= 1} aria-label="Rimuovi scadenza" className="col-start-3 sm:col-start-4">
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setFisse((rows) => [...rows, { mese: 12, giorno: 31, etichetta: "" }])}>
              <Plus className="h-4 w-4" /> Aggiungi scadenza
            </Button>
          </div>
        )}

        {ricorrenza === "UNA_TANTUM" && (
          <Alert kind="info">Gli adempimenti una tantum non generano scadenze automatiche: servono solo per classificare le attività create a mano.</Alert>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">A chi si applica</h3>
        <p className="text-xs text-slate-500">Lascia tutte le caselle vuote per applicare l&apos;adempimento a qualsiasi regime / tipo di soggetto.</p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <fieldset className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-xs font-medium text-slate-600">Regimi fiscali</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Object.entries(REGIMI_FISCALI).map(([k, v]) => (
                <Checkbox key={k} name="regimi" value={k} defaultChecked={valori.regimi.includes(k)} label={v} className="min-h-10" />
              ))}
            </div>
          </fieldset>
          <fieldset className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-xs font-medium text-slate-600">Tipi di soggetto</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Object.entries(TIPI_SOGGETTO).map(([k, v]) => (
                <Checkbox key={k} name="tipiSoggetto" value={k} defaultChecked={valori.tipiSoggetto.includes(k)} label={v} className="min-h-10" />
              ))}
            </div>
          </fieldset>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Dipendenti" htmlFor="soloConDipendenti">
            <Select id="soloConDipendenti" name="soloConDipendenti" defaultValue={triValore(valori.soloConDipendenti)}>
              <option value="">Qualsiasi</option>
              <option value="si">Solo con dipendenti</option>
              <option value="no">Solo senza dipendenti</option>
            </Select>
          </Field>
          <Field label="Partita IVA" htmlFor="soloConIva">
            <Select id="soloConIva" name="soloConIva" defaultValue={triValore(valori.soloConIva)}>
              <option value="">Qualsiasi</option>
              <option value="si">Solo con partita IVA</option>
              <option value="no">Solo senza partita IVA</option>
            </Select>
          </Field>
          <Field label="Periodicità IVA" htmlFor="periodicitaIva">
            <Select id="periodicitaIva" name="periodicitaIva" defaultValue={valori.periodicitaIva ?? ""}>
              <option value="">Qualsiasi</option>
              <option value="MENSILE">Solo mensile</option>
              <option value="TRIMESTRALE">Solo trimestrale</option>
            </Select>
          </Field>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <Checkbox name="soloSuRichiesta" defaultChecked={valori.soloSuRichiesta} label="Solo su richiesta (va attivato cliente per cliente)" className="min-h-10" />
          <Checkbox name="attivo" defaultChecked={valori.attivo} label="Adempimento attivo" className="min-h-10" />
        </div>
        <Field label="Ordine di visualizzazione" htmlFor="ordine" hint="Numero crescente: determina la posizione nel catalogo." className="sm:max-w-xs">
          <Input id="ordine" name="ordine" type="number" min={0} max={9999} defaultValue={valori.ordine} />
        </Field>
      </section>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <Button href="/adempimenti" variant="outline">
          Annulla
        </Button>
        <SubmitButton pendingText="Salvataggio…">{valori.id ? "Salva modifiche" : "Crea adempimento"}</SubmitButton>
      </div>
    </form>
  );
}
