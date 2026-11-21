import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calcolaStato, esitoGiornalieri, esitoPosta, pianificatoreInternoAttivo } from "../../src/lib/cron/stato";

const adesso = new Date("2027-01-10T09:00:00Z");
const oreFa = (h: number) => new Date(adesso.getTime() - h * 3600_000);
const minutiFa = (m: number) => new Date(adesso.getTime() - m * 60_000);

describe("registro delle elaborazioni: esito", () => {
  it("l'importazione della posta non è riuscita se TUTTE le caselle falliscono", () => {
    assert.equal(esitoPosta({ a: { error: "401" }, b: { error: "rete" } }), "ERRORE");
    assert.equal(esitoPosta({ a: { error: "401" }, b: {} }), "PARZIALE");
    assert.equal(esitoPosta({ a: {}, b: {} }), "OK");
    assert.equal(esitoPosta({}), "OK", "nessuna casella collegata: niente da fare, non è un errore");
  });

  it("i giornalieri non sono riusciti se falliscono i promemoria", () => {
    assert.equal(esitoGiornalieri({ promemoria: { error: "db" }, assenze: {} }), "ERRORE");
    assert.equal(esitoGiornalieri({ promemoria: {}, assenze: { error: "db" } }), "PARZIALE");
    assert.equal(esitoGiornalieri({ promemoria: {}, assenze: {} }), "OK");
  });
});

describe("registro delle elaborazioni: stato mostrato", () => {
  it("regolare se l'ultima riuscita è recente", () => {
    assert.equal(calcolaStato("daily", { ultimaRiuscita: oreFa(2), ultimoEsito: "OK", lucchettoPresoDa: null }, adesso), "REGOLARE");
  });

  it("in ritardo se il giornaliero non riesce da più di 26 ore", () => {
    assert.equal(calcolaStato("daily", { ultimaRiuscita: oreFa(27), ultimoEsito: "OK", lucchettoPresoDa: null }, adesso), "IN_RITARDO");
  });

  it("la posta è in ritardo dopo un'ora", () => {
    assert.equal(calcolaStato("gmail", { ultimaRiuscita: oreFa(2), ultimoEsito: "OK", lucchettoPresoDa: null }, adesso), "IN_RITARDO");
  });

  it("in corso se il lucchetto è stato preso da poco", () => {
    assert.equal(calcolaStato("daily", { ultimaRiuscita: oreFa(2), ultimoEsito: "OK", lucchettoPresoDa: minutiFa(3) }, adesso), "IN_CORSO");
  });

  it("un lucchetto abbandonato (processo caduto a metà) non è «in corso»: è un ritardo", () => {
    assert.equal(calcolaStato("daily", { ultimaRiuscita: oreFa(30), ultimoEsito: "OK", lucchettoPresoDa: oreFa(5) }, adesso), "IN_RITARDO");
  });

  it("ultima non riuscita, se è fallita l'ultima esecuzione", () => {
    assert.equal(calcolaStato("daily", { ultimaRiuscita: oreFa(3), ultimoEsito: "ERRORE", lucchettoPresoDa: null }, adesso), "NON_RIUSCITA");
    assert.equal(calcolaStato("daily", { ultimaRiuscita: null, ultimoEsito: "ERRORE", lucchettoPresoDa: null }, adesso), "NON_RIUSCITA");
  });

  it("mai eseguita", () => {
    assert.equal(calcolaStato("daily", { ultimaRiuscita: null, ultimoEsito: null, lucchettoPresoDa: null }, adesso), "MAI_ESEGUITA");
  });
});

describe("pianificatore interno", () => {
  it("un solo criterio per l'avvio e per il pannello", () => {
    assert.equal(pianificatoreInternoAttivo({}), true);
    assert.equal(pianificatoreInternoAttivo({ ENABLE_CRON: "false" }), false);
    assert.equal(pianificatoreInternoAttivo({ ENABLE_CRON: "0" }), false);
    assert.equal(pianificatoreInternoAttivo({ ENABLE_CRON: "true" }), true);
  });
});
