import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { abbinaScadenze, chiaveStabile, chiaveTask, type AttivitaPresente } from "../../src/lib/adempimenti/regole";

const ctx = { clientId: "c1", templateId: "t-iva", anno: 2027 };
const giorno = (m: number, g: number) => new Date(2027, m - 1, g, 12);
const voce = (periodo: string, m: number, g: number, idx = m * 100 + g) => ({ idx, scadenza: giorno(m, g), periodo, titolo: `IVA – ${periodo}` });
const presente = (p: Partial<AttivitaPresente> & { id: string; scadenza: Date }): AttivitaPresente => ({
  chiave: null,
  periodo: null,
  stato: "DA_FARE",
  ...p,
});

describe("pianificazione: niente doppioni quando la data del catalogo cambia", () => {
  it("una scadenza spostata nel catalogo trova l'attività già generata con la data vecchia", () => {
    // generata con lo schema vecchio: chiave con mese*100+giorno del 16 marzo
    const vecchia = presente({ id: "a1", periodo: "Saldo 2026", scadenza: giorno(3, 16), chiave: chiaveTask("c1", "t-iva", 2027, 316) });
    // il catalogo ora dice 16 aprile
    const [r] = abbinaScadenze([voce("Saldo 2026", 4, 16)], [vecchia], ctx);
    assert.equal(r.presente?.id, "a1", "deve riconoscerla: prima ne nasceva una seconda");
  });

  it("lo stesso per un adempimento mensile", () => {
    const gennaio = presente({ id: "g", periodo: "Gennaio 2027", scadenza: giorno(2, 16), chiave: chiaveTask("c1", "t-iva", 2027, 1) });
    const [r] = abbinaScadenze([voce("Gennaio 2027", 2, 20, 1)], [gennaio], ctx);
    assert.equal(r.presente?.id, "g");
  });

  it("una seconda pianificazione con la stessa versione riconosce le proprie chiavi", () => {
    const k = chiaveStabile("c1", "t-iva", 2027, "Saldo 2026", 1);
    const [r] = abbinaScadenze([voce("Saldo 2026", 3, 16)], [presente({ id: "a1", periodo: "Saldo 2026", scadenza: giorno(3, 16), chiave: k })], ctx);
    assert.equal(r.presente?.id, "a1");
    assert.equal(r.chiave, k);
  });
});

describe("pianificazione: due scadenze nello stesso giorno restano due", () => {
  it("con periodi diversi", () => {
    const r = abbinaScadenze([voce("Saldo 2026", 3, 16), voce("I rata 2027", 3, 16, 10316)], [], ctx);
    assert.equal(r.filter((x) => !x.presente).length, 2);
    assert.notEqual(r[0].chiave, r[1].chiave);
  });

  it("con lo stesso periodo (voci senza etichetta)", () => {
    const r = abbinaScadenze([voce("2027", 6, 30), voce("2027", 6, 30, 10630)], [], ctx);
    assert.equal(r.filter((x) => !x.presente).length, 2, "prima la seconda non veniva mai creata");
    assert.notEqual(r[0].chiave, r[1].chiave);
  });

  it("un'attività presente si abbina a una sola scadenza", () => {
    const unica = presente({ id: "x", scadenza: giorno(6, 30) });
    const r = abbinaScadenze([voce("2027", 6, 30), voce("2027", 6, 30, 10630)], [unica], ctx);
    assert.equal(r.filter((x) => x.presente?.id === "x").length, 1);
  });
});

describe("pianificazione: le attività scritte a mano", () => {
  it("un'attività scritta a mano nello stesso giorno evita il doppione", () => {
    const aMano = presente({ id: "m", scadenza: giorno(3, 16) });
    const [r] = abbinaScadenze([voce("Saldo 2026", 3, 16)], [aMano], ctx);
    assert.equal(r.presente?.id, "m");
  });

  it("un'attività scritta a mano in un altro giorno non viene presa per quella generata", () => {
    const aMano = presente({ id: "m", scadenza: giorno(3, 10) });
    const [r] = abbinaScadenze([voce("Saldo 2026", 3, 16)], [aMano], ctx);
    assert.equal(r.presente, null);
  });
});
