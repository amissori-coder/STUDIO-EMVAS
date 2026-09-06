import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pasqua, isFestivo, primoGiornoLavorativo, ultimoGiornoMese } from "../../src/lib/adempimenti/calendario";

describe("calendario fiscale", () => {
  it("calcola la Pasqua correttamente", () => {
    assert.equal(pasqua(2024).toDateString(), new Date(2024, 2, 31).toDateString());
    assert.equal(pasqua(2025).toDateString(), new Date(2025, 3, 20).toDateString());
    assert.equal(pasqua(2026).toDateString(), new Date(2026, 3, 5).toDateString());
    assert.equal(pasqua(2027).toDateString(), new Date(2027, 2, 28).toDateString());
  });

  it("riconosce festivi e weekend", () => {
    assert.equal(isFestivo(new Date(2026, 0, 1)), true); // Capodanno
    assert.equal(isFestivo(new Date(2026, 3, 6)), true); // Lunedì dell'Angelo 2026
    assert.equal(isFestivo(new Date(2026, 7, 15)), true); // Ferragosto
    assert.equal(isFestivo(new Date(2026, 8, 5)), true); // sabato
    assert.equal(isFestivo(new Date(2026, 8, 7)), false); // lunedì lavorativo
  });

  it("sposta le scadenze al primo giorno lavorativo", () => {
    // 16 maggio 2026 è sabato -> lunedì 18
    assert.equal(primoGiornoLavorativo(new Date(2026, 4, 16, 12)).getDate(), 18);
    // 16 agosto 2026 domenica -> 17
    assert.equal(primoGiornoLavorativo(new Date(2026, 7, 16, 12)).getDate(), 17);
    // 1 novembre 2026 domenica (festivo) -> 2
    assert.equal(primoGiornoLavorativo(new Date(2026, 10, 1, 12)).getDate(), 2);
    // giorno lavorativo resta uguale
    assert.equal(primoGiornoLavorativo(new Date(2026, 8, 16, 12)).getDate(), 16);
  });

  it("ultimo giorno del mese", () => {
    assert.equal(ultimoGiornoMese(2026, 2), 28);
    assert.equal(ultimoGiornoMese(2028, 2), 29);
    assert.equal(ultimoGiornoMese(2026, 12), 31);
  });
});
