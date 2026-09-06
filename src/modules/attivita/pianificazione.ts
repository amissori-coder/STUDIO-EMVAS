// Tipi e helper (serializzabili) per la pianificazione degli adempimenti di un cliente.
import type { AnteprimaVoce } from "@/lib/adempimenti/engine";

export interface AnteprimaRiga {
  templateId: string;
  nome: string;
  categoria: string;
  ricorrenza: string;
  attivo: boolean;
  soloSuRichiesta: boolean;
  applicabile: boolean;
  /** null = automatico, true = attivato, false = disattivato */
  override: boolean | null;
  generare: boolean;
  nScadenze: number;
  /** date ISO delle scadenze calcolate */
  scadenze: string[];
  esistenti: number;
}

export function serializzaAnteprima(voci: AnteprimaVoce[]): AnteprimaRiga[] {
  return voci.map((v) => ({
    templateId: v.template.id,
    nome: v.template.nome,
    categoria: v.template.categoria,
    ricorrenza: v.template.ricorrenza,
    attivo: v.template.attivo,
    soloSuRichiesta: v.template.soloSuRichiesta,
    applicabile: v.applicabile,
    override: v.override,
    generare: v.generare,
    nScadenze: v.scadenze.length,
    scadenze: v.scadenze.map((s) => s.scadenza.toISOString()),
    esistenti: v.esistenti,
  }));
}
