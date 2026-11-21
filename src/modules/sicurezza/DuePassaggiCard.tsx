"use client";
import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  annullaConfigurazioneAction,
  avviaConfigurazioneAction,
  confermaConfigurazioneAction,
  disattivaAction,
  rigeneraCodiciAction,
  type DuePassaggiState,
} from "./actions";

export type StatoDuePassaggi =
  | { stato: "spenta" }
  | { stato: "configurazione"; segreto: string; qrSvg: string }
  | { stato: "attiva"; attivaDal: string | null; codiciRimasti: number };

function CampoCodice({ id, recupero = false }: { id: string; recupero?: boolean }) {
  return (
    <Input
      id={id}
      name="codice"
      required
      autoComplete={recupero ? "off" : "one-time-code"}
      inputMode={recupero ? "text" : "numeric"}
      maxLength={recupero ? 12 : 7}
      placeholder="123456"
      className="tracking-widest"
    />
  );
}

/** I codici di recupero appena generati: si vedono una volta sola, quindi si copiano o si scaricano subito. */
function CodiciRecupero({ codici, onChiudi }: { codici: string[]; onChiudi: () => void }) {
  const [copiati, setCopiati] = useState(false);
  const testo = `Studio EMVAS - codici di recupero della verifica in due passaggi\nOgni codice vale una volta sola.\n\n${codici.join("\n")}\n`;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">Salva adesso questi codici di recupero: non verranno mostrati di nuovo.</p>
      <p className="mt-1 text-xs text-amber-800">
        Servono per entrare se perdi o cambi il telefono. Conservali in un posto sicuro (ad esempio stampati in ufficio o in un gestore di password), non nel telefono stesso.
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm text-slate-900">
        {codici.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(testo);
              setCopiati(true);
            } catch {
              setCopiati(false);
            }
          }}
        >
          {copiati ? "Copiati" : "Copia"}
        </Button>
        <a
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(testo)}`}
          download="studio-emvas-codici-recupero.txt"
          className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 lg:h-8"
        >
          Scarica
        </a>
        <Button type="button" size="sm" onClick={onChiudi}>
          Li ho salvati
        </Button>
      </div>
    </div>
  );
}

export function DuePassaggiCard({ dati, hasPassword, avvisoRecupero }: { dati: StatoDuePassaggi; hasPassword: boolean; avvisoRecupero: number | null }) {
  // tutti gli stati delle azioni stanno qui in cima: il componente resta montato quando la pagina si
  // aggiorna dopo l'azione, quindi i codici appena generati e le conferme non spariscono
  const [avvio, avvia] = useActionState<DuePassaggiState, FormData>(() => avviaConfigurazioneAction(), {});
  const [, annulla] = useActionState<DuePassaggiState, FormData>(() => annullaConfigurazioneAction(), {});
  const [conferma, conferma_] = useActionState(confermaConfigurazioneAction, {});
  const [rigenera, rigenera_] = useActionState(rigeneraCodiciAction, {});
  const [disattiva, disattiva_] = useActionState(disattivaAction, {});
  const [nascosti, setNascosti] = useState<number[]>([]);

  const codici = [conferma, rigenera].find((s) => s.codici && s.nonce && !nascosti.includes(s.nonce));
  const messaggio = [conferma, rigenera, disattiva].filter((s) => s.message && s.nonce).sort((a, b) => (b.nonce ?? 0) - (a.nonce ?? 0))[0];

  return (
    <div className="space-y-4">
      {messaggio?.message && <Alert kind="success">{messaggio.message}</Alert>}
      {codici?.codici && <CodiciRecupero codici={codici.codici} onChiudi={() => setNascosti((n) => [...n, codici.nonce!])} />}

      {dati.stato === "spenta" && (
        <>
          <p className="text-sm text-slate-600">
            Oltre alla password, all&apos;accesso viene chiesto un codice di 6 cifre generato da un&apos;app sul tuo telefono (Google Authenticator, Microsoft Authenticator o
            simili). Chi scopre la password non può entrare senza il telefono.
          </p>
          {avvio.error && <Alert kind="error">{avvio.error}</Alert>}
          <form action={avvia}>
            <SubmitButton pendingText="Preparazione…">Attiva la verifica in due passaggi</SubmitButton>
          </form>
        </>
      )}

      {dati.stato === "configurazione" && (
        <>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-slate-700">
            <li>Installa sul telefono un&apos;app di autenticazione, ad esempio Google Authenticator o Microsoft Authenticator.</li>
            <li>
              Nell&apos;app aggiungi un account inquadrando questo codice QR:
              <div className="mt-2 w-44 rounded-lg border border-slate-200 bg-white p-2" dangerouslySetInnerHTML={{ __html: dati.qrSvg }} />
              <p className="mt-2 text-xs text-slate-500">
                Non riesci a inquadrarlo? Scegli «inserisci chiave» e digita: <span className="select-all font-mono text-slate-800">{dati.segreto}</span> (tipo: basato
                sull&apos;ora).
              </p>
            </li>
            <li>Scrivi qui sotto il codice di 6 cifre che l&apos;app mostra per «Studio EMVAS».</li>
          </ol>
          {conferma.error && <Alert kind="error">{conferma.error}</Alert>}
          <form action={conferma_} className="flex flex-wrap items-end gap-2">
            <Field label="Codice dall'app" htmlFor="totp-conferma" className="w-40">
              <CampoCodice id="totp-conferma" />
            </Field>
            <SubmitButton pendingText="Verifica…">Conferma e attiva</SubmitButton>
          </form>
          <form action={annulla}>
            <button type="submit" className="text-sm text-slate-500 hover:underline">
              Annulla
            </button>
          </form>
        </>
      )}

      {dati.stato === "attiva" && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <Badge color="green">Attiva</Badge>
            {dati.attivaDal && <span>dal {dati.attivaDal}</span>}
          </div>
          {avvisoRecupero !== null && (
            <Alert kind="warning">
              Hai usato un codice di recupero per entrare: {avvisoRecupero === 1 ? "te ne resta 1" : `te ne restano ${avvisoRecupero}`}. Genera nuovi codici qui sotto (serve il codice
              dell&apos;app) oppure, se hai cambiato telefono, disattiva e riattiva la verifica.
            </Alert>
          )}
          <p className={dati.codiciRimasti <= 3 ? "text-sm font-medium text-amber-700" : "text-sm text-slate-600"}>
            Codici di recupero ancora validi: {dati.codiciRimasti}
            {dati.codiciRimasti <= 3 ? " — generane di nuovi prima di restare senza." : ""}
          </p>

          <details className="rounded-lg border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-800">Genera nuovi codici di recupero</summary>
            <p className="mt-2 text-xs text-slate-500">I codici attuali smetteranno di valere.</p>
            {rigenera.error && (
              <Alert kind="error" className="mt-2">
                {rigenera.error}
              </Alert>
            )}
            <form action={rigenera_} className="mt-2 flex flex-wrap items-end gap-2">
              <Field label="Codice dall'app" htmlFor="totp-rigenera" className="w-40">
                <CampoCodice id="totp-rigenera" />
              </Field>
              <SubmitButton variant="outline" pendingText="Generazione…">
                Genera
              </SubmitButton>
            </form>
          </details>

          <details className="rounded-lg border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-800">Disattiva la verifica in due passaggi</summary>
            <p className="mt-2 text-xs text-slate-500">Se hai perso il telefono puoi usare un codice di recupero al posto del codice dell&apos;app.</p>
            {disattiva.error && (
              <Alert kind="error" className="mt-2">
                {disattiva.error}
              </Alert>
            )}
            <form action={disattiva_} className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {hasPassword && (
                <Field label="Password" htmlFor="totp-password">
                  <Input id="totp-password" name="password" type="password" autoComplete="current-password" required />
                </Field>
              )}
              <Field label="Codice dall'app o di recupero" htmlFor="totp-disattiva">
                <CampoCodice id="totp-disattiva" recupero />
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton variant="danger" pendingText="Disattivazione…">
                  Disattiva
                </SubmitButton>
              </div>
            </form>
          </details>
        </>
      )}
    </div>
  );
}
