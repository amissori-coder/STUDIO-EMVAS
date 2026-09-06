import { Badge, REGIME_COLOR } from "@/components/ui/Badge";
import { REGIMI_FISCALI, TIPI_SOGGETTO } from "@/lib/constants";

/** Etichetta breve del tipo soggetto (per badge e liste). */
export function tipoSoggettoBreve(tipo: string) {
  const brevi: Record<string, string> = {
    PERSONA_FISICA: "Persona fisica",
    DITTA_INDIVIDUALE: "Ditta individuale",
    PROFESSIONISTA: "Professionista",
    SNC: "S.n.c.",
    SAS: "S.a.s.",
    SRL: "S.r.l.",
    SRLS: "S.r.l.s.",
    SPA: "S.p.A.",
    ASSOCIAZIONE: "Associazione",
    CONDOMINIO: "Condominio",
    ALTRO: "Altro",
  };
  return brevi[tipo] ?? TIPI_SOGGETTO[tipo as keyof typeof TIPI_SOGGETTO] ?? tipo;
}

export function regimeBreve(regime: string) {
  const brevi: Record<string, string> = {
    ORDINARIO: "Ordinario",
    SEMPLIFICATO: "Semplificato",
    FORFETTARIO: "Forfettario",
    NON_TITOLARE: "Senza P. IVA",
  };
  return brevi[regime] ?? REGIMI_FISCALI[regime as keyof typeof REGIMI_FISCALI] ?? regime;
}

export function ClientBadges({ tipoSoggetto, regimeFiscale, attivo }: { tipoSoggetto: string; regimeFiscale: string; attivo?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge color="slate" className="whitespace-nowrap">{tipoSoggettoBreve(tipoSoggetto)}</Badge>
      <Badge color={REGIME_COLOR[regimeFiscale] ?? "slate"} className="whitespace-nowrap">
        {regimeBreve(regimeFiscale)}
      </Badge>
      {attivo === false && (
        <Badge color="orange" className="whitespace-nowrap">
          Archiviato
        </Badge>
      )}
    </span>
  );
}
