"use client";
import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PERIODICITA_IVA, REGIMI_FISCALI, TIPI_SOGGETTO } from "@/lib/constants";
import type { ClientFormState } from "./actions";
import type { ClientFormValues } from "./validation";

export interface StaffOption {
  id: string;
  nome: string;
  ruolo: string;
  /** false se l'utente è disattivato (compare solo se è il referente attuale del cliente) */
  attivo?: boolean;
}

export function ClientForm({
  action,
  initial,
  staff,
  mode,
  canToggleActive,
  canChangeReferente = true,
  cancelHref,
}: {
  action: (prev: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  initial?: Partial<ClientFormValues>;
  staff: StaffOption[];
  mode: "create" | "edit";
  canToggleActive: boolean;
  /** false: il referente viene mostrato ma non è modificabile (solo admin o referente attuale possono cambiarlo) */
  canChangeReferente?: boolean;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState<ClientFormState, FormData>(action, {});
  const values: Partial<ClientFormValues> = state.values ?? initial ?? {};
  const errors = state.fieldErrors ?? {};
  const v = (k: keyof ClientFormValues) => values[k] ?? "";
  const checked = (k: keyof ClientFormValues, fallback: boolean) => {
    const raw = values[k];
    if (raw === undefined) return fallback;
    return raw === "on" || raw === "true";
  };
  const referenteAttuale = staff.find((s) => s.id === v("referenteId"));
  const referenteDisattivato = !!referenteAttuale && referenteAttuale.attivo === false;
  const referenteHint = !canChangeReferente
    ? "Solo un amministratore o il referente attuale può cambiare il referente."
    : referenteDisattivato
      ? "Il referente attuale è stato disattivato: non riceve più notifiche. Scegli un altro collaboratore."
      : "Riceve le notifiche relative al cliente.";

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert kind="error">{state.error}</Alert>}

      <Card>
        <CardHeader title="Dati anagrafici" description="Denominazione e inquadramento fiscale del cliente." />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Denominazione *" htmlFor="denominazione" error={errors.denominazione} className="sm:col-span-2">
            <Input id="denominazione" name="denominazione" defaultValue={v("denominazione")} required maxLength={200} autoFocus={mode === "create"} placeholder="Es. Rossi Impianti S.r.l." />
          </Field>
          <Field label="Tipo soggetto *" htmlFor="tipoSoggetto" error={errors.tipoSoggetto}>
            <Select id="tipoSoggetto" name="tipoSoggetto" defaultValue={v("tipoSoggetto") || "SRL"} required>
              {Object.entries(TIPI_SOGGETTO).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Regime fiscale *" htmlFor="regimeFiscale" error={errors.regimeFiscale}>
            <Select id="regimeFiscale" name="regimeFiscale" defaultValue={v("regimeFiscale") || "ORDINARIO"} required>
              {Object.entries(REGIMI_FISCALI).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Periodicità IVA" htmlFor="periodicitaIva" error={errors.periodicitaIva} hint="Usata dal pianificatore degli adempimenti.">
            <Select id="periodicitaIva" name="periodicitaIva" defaultValue={v("periodicitaIva") || "NESSUNA"}>
              {Object.entries(PERIODICITA_IVA).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-col justify-end gap-3 pb-1">
            <Checkbox name="haDipendenti" label="Ha dipendenti / collaboratori" defaultChecked={checked("haDipendenti", false)} className="min-h-10" />
            {canToggleActive ? (
              <Checkbox name="attivo" label="Cliente attivo (non archiviato)" defaultChecked={checked("attivo", true)} className="min-h-10" />
            ) : (
              <input type="hidden" name="attivo" value={checked("attivo", true) ? "on" : ""} />
            )}
          </div>
          <Field label="Codice fiscale" htmlFor="codiceFiscale" error={errors.codiceFiscale}>
            <Input id="codiceFiscale" name="codiceFiscale" defaultValue={v("codiceFiscale")} maxLength={16} className="uppercase" autoCapitalize="characters" />
          </Field>
          <Field label="Partita IVA" htmlFor="partitaIva" error={errors.partitaIva} hint="11 cifre.">
            <Input id="partitaIva" name="partitaIva" defaultValue={v("partitaIva")} inputMode="numeric" maxLength={13} placeholder="01234567890" />
          </Field>
          <Field label="Codice ATECO" htmlFor="codiceAteco" error={errors.codiceAteco}>
            <Input id="codiceAteco" name="codiceAteco" defaultValue={v("codiceAteco")} maxLength={20} placeholder="Es. 43.22.01" />
          </Field>
          <Field label="Descrizione attività" htmlFor="attivita" error={errors.attivita}>
            <Input id="attivita" name="attivita" defaultValue={v("attivita")} maxLength={300} placeholder="Es. Installazione impianti idraulici" />
          </Field>
          <Field label="Referente dello studio" htmlFor="referenteId" error={errors.referenteId} hint={referenteHint}>
            {/* Un select disabilitato non viene inviato: il valore attuale viaggia nell'input nascosto */}
            {!canChangeReferente && <input type="hidden" name="referenteId" value={v("referenteId")} />}
            <Select id="referenteId" name={canChangeReferente ? "referenteId" : undefined} defaultValue={v("referenteId")} disabled={!canChangeReferente}>
              <option value="">— Nessun referente —</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                  {s.attivo === false ? " (disattivato)" : ""}
                </option>
              ))}
            </Select>
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Contatti e sede" />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="email" error={errors.email}>
            <Input id="email" name="email" type="email" defaultValue={v("email")} maxLength={200} autoComplete="off" />
          </Field>
          <Field label="PEC" htmlFor="pec" error={errors.pec}>
            <Input id="pec" name="pec" type="email" defaultValue={v("pec")} maxLength={200} autoComplete="off" />
          </Field>
          <Field label="Telefono" htmlFor="telefono" error={errors.telefono}>
            <Input id="telefono" name="telefono" type="tel" defaultValue={v("telefono")} maxLength={50} />
          </Field>
          <Field label="Indirizzo" htmlFor="indirizzo" error={errors.indirizzo}>
            <Input id="indirizzo" name="indirizzo" defaultValue={v("indirizzo")} maxLength={200} placeholder="Via, numero civico" />
          </Field>
          <div className="grid grid-cols-3 gap-3 sm:col-span-2 sm:grid-cols-6">
            <Field label="CAP" htmlFor="cap" error={errors.cap} className="col-span-1">
              <Input id="cap" name="cap" defaultValue={v("cap")} inputMode="numeric" maxLength={5} />
            </Field>
            <Field label="Comune" htmlFor="comune" error={errors.comune} className="col-span-2 sm:col-span-4">
              <Input id="comune" name="comune" defaultValue={v("comune")} maxLength={100} />
            </Field>
            <Field label="Provincia" htmlFor="provincia" error={errors.provincia} className="col-span-3 sm:col-span-1">
              <Input id="provincia" name="provincia" defaultValue={v("provincia")} maxLength={2} className="uppercase" placeholder="RM" autoCapitalize="characters" />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Note interne" description="Visibili solo allo staff dello studio." />
        <CardBody>
          <Field label="Note" htmlFor="note" error={errors.note}>
            <Textarea id="note" name="note" defaultValue={v("note")} maxLength={4000} rows={4} />
          </Field>
        </CardBody>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" href={cancelHref}>
          Annulla
        </Button>
        <SubmitButton pendingText="Salvataggio…">{mode === "create" ? "Crea cliente" : "Salva modifiche"}</SubmitButton>
      </div>
    </form>
  );
}
