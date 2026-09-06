import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AdempimentoTemplate } from "@prisma/client";
import { calcolaScadenze, deveGenerare, isApplicabile } from "../../src/lib/adempimenti/regole";
import { CATALOGO_ADEMPIMENTI } from "../../src/lib/adempimenti/catalogo";

function template(partial: Partial<AdempimentoTemplate> & { codice: string }): AdempimentoTemplate {
  const cat = CATALOGO_ADEMPIMENTI.find((t) => t.codice === partial.codice);
  return {
    id: partial.codice,
    nome: cat?.nome ?? partial.codice,
    descrizione: cat?.descrizione ?? null,
    categoria: cat?.categoria ?? "ALTRO",
    ricorrenza: cat?.ricorrenza ?? "ANNUALE",
    scadenze: JSON.stringify(cat?.scadenze ?? []),
    regimi: JSON.stringify(cat?.regimi ?? []),
    tipiSoggetto: JSON.stringify(cat?.tipiSoggetto ?? []),
    soloConDipendenti: cat?.soloConDipendenti ?? null,
    soloConIva: cat?.soloConIva ?? null,
    periodicitaIva: cat?.periodicitaIva ?? null,
    soloSuRichiesta: cat?.soloSuRichiesta ?? false,
    giorniPreavviso: cat?.giorniPreavviso ?? 7,
    attivo: true,
    ordine: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

const srl = { id: "c1", tipoSoggetto: "SRL", regimeFiscale: "ORDINARIO", periodicitaIva: "MENSILE", haDipendenti: true, partitaIva: "01234567890" };
const forfettario = { id: "c2", tipoSoggetto: "PROFESSIONISTA", regimeFiscale: "FORFETTARIO", periodicitaIva: "NESSUNA", haDipendenti: false, partitaIva: "09876543210" };
const privato = { id: "c3", tipoSoggetto: "PERSONA_FISICA", regimeFiscale: "NON_TITOLARE", periodicitaIva: "NESSUNA", haDipendenti: false, partitaIva: null };
const barTrim = { id: "c4", tipoSoggetto: "DITTA_INDIVIDUALE", regimeFiscale: "SEMPLIFICATO", periodicitaIva: "TRIMESTRALE", haDipendenti: true, partitaIva: "11223344556" };

describe("applicabilità adempimenti", () => {
  it("IVA mensile solo ai mensili con partita IVA in regime ordinario/semplificato", () => {
    const t = template({ codice: "IVA_LIQ_MENSILE" });
    assert.equal(isApplicabile(t, srl), true);
    assert.equal(isApplicabile(t, barTrim), false);
    assert.equal(isApplicabile(t, forfettario), false);
    assert.equal(isApplicabile(t, privato), false);
  });

  it("IVA trimestrale al bar trimestrale ma non alla SRL mensile", () => {
    const t = template({ codice: "IVA_LIQ_TRIMESTRALE" });
    assert.equal(isApplicabile(t, barTrim), true);
    assert.equal(isApplicabile(t, srl), false);
  });

  it("730 solo ai privati; Redditi PF ai privati e alle persone fisiche con partita IVA", () => {
    assert.equal(isApplicabile(template({ codice: "MODELLO_730" }), privato), true);
    assert.equal(isApplicabile(template({ codice: "MODELLO_730" }), forfettario), false);
    assert.equal(isApplicabile(template({ codice: "REDDITI_PF" }), forfettario), true);
    assert.equal(isApplicabile(template({ codice: "REDDITI_PF" }), srl), false);
    assert.equal(isApplicabile(template({ codice: "REDDITI_SC" }), srl), true);
  });

  it("adempimenti con dipendenti e forfettario", () => {
    assert.equal(isApplicabile(template({ codice: "F24_RITENUTE_CONTRIBUTI" }), srl), true);
    assert.equal(isApplicabile(template({ codice: "F24_RITENUTE_CONTRIBUTI" }), forfettario), false);
    assert.equal(isApplicabile(template({ codice: "FORFETTARIO_REQUISITI" }), forfettario), true);
    assert.equal(isApplicabile(template({ codice: "FORFETTARIO_REQUISITI" }), srl), false);
    assert.equal(isApplicabile(template({ codice: "BOLLO_FE" }), forfettario), true);
    assert.equal(isApplicabile(template({ codice: "IVA_DICHIARAZIONE" }), forfettario), false);
  });

  it("solo su richiesta: generato solo con override attivo", () => {
    const imu = template({ codice: "IMU" });
    assert.equal(isApplicabile(imu, srl), true);
    assert.equal(deveGenerare(imu, srl, null), false);
    assert.equal(deveGenerare(imu, srl, { attivo: true }), true);
    assert.equal(deveGenerare(template({ codice: "IVA_LIQ_MENSILE" }), srl, { attivo: false }), false);
    assert.equal(deveGenerare(template({ codice: "IVA_LIQ_MENSILE" }), forfettario, { attivo: true }), true);
  });

  it("template non attivo non genera mai", () => {
    assert.equal(deveGenerare(template({ codice: "IVA_LIQ_MENSILE", attivo: false }), srl, { attivo: true }), false);
  });
});

describe("calcolo scadenze", () => {
  it("mensile: 12 scadenze il 16, competenza mese precedente, spostate al giorno lavorativo", () => {
    const s = calcolaScadenze(template({ codice: "IVA_LIQ_MENSILE" }), 2026);
    assert.equal(s.length, 12);
    assert.equal(s[0].periodo, "Dicembre 2025");
    assert.equal(s[0].scadenza.getMonth(), 0);
    assert.equal(s[0].scadenza.getDate(), 16);
    // maggio 2026: 16 è sabato -> 18
    assert.equal(s[4].scadenza.getDate(), 18);
    assert.equal(s[4].periodo, "Aprile 2026");
    assert.equal(s[7].scadenza.getDate(), 17); // 16 agosto domenica -> 17
    assert.ok(s[0].titolo.includes("Dicembre 2025"));
  });

  it("mensile con giorno 0 = ultimo giorno del mese (UniEmens)", () => {
    const s = calcolaScadenze(template({ codice: "UNIEMENS" }), 2026);
    assert.equal(s[1].scadenza.getDate(), 2); // 28/02/2026 sabato -> lunedì 2 marzo
    assert.equal(s[1].scadenza.getMonth(), 2);
  });

  it("annuale con più voci ordinate per data e segnaposto sostituiti", () => {
    const s = calcolaScadenze(template({ codice: "IMPOSTE_SALDO_ACCONTO" }), 2026);
    assert.equal(s.length, 1);
    assert.equal(s[0].periodo, "Saldo 2025 e 1° acconto 2026");
    assert.equal(s[0].scadenza.getMonth(), 5);
    assert.equal(s[0].scadenza.getDate(), 30);

    const lipe = calcolaScadenze(template({ codice: "LIPE" }), 2026);
    assert.equal(lipe.length, 4);
    assert.equal(lipe[0].periodo, "4° trimestre 2025");
    assert.equal(lipe[0].scadenza.getMonth(), 2); // 28/02/2026 sabato -> 2 marzo
    assert.equal(lipe[0].scadenza.getDate(), 2);
    assert.equal(lipe[3].scadenza.getMonth(), 10);
    assert.equal(lipe[3].scadenza.getDate(), 30);
  });

  it("una tantum non genera scadenze", () => {
    assert.equal(calcolaScadenze(template({ codice: "ROTTAMAZIONE" }), 2026).length, 0);
  });

  it("indici univoci per la chiave di deduplica", () => {
    for (const cat of CATALOGO_ADEMPIMENTI) {
      const s = calcolaScadenze(template({ codice: cat.codice }), 2026);
      const idx = new Set(s.map((x) => x.idx));
      assert.equal(idx.size, s.length, cat.codice);
    }
  });
});
