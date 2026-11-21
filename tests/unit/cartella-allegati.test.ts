import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cartellaDiSalvataggio, cartellaProposta, ordinaCartelle } from "../../src/modules/email/cartella-allegati";

const fatture = { id: "f-fatture", nome: "Fatture di acquisto", ordine: 1, visibileCliente: true };
const altro = { id: "f-altro", nome: "Altro", ordine: 9, visibileCliente: true };
const riservata = { id: "f-riservata", nome: "Riservata allo studio", ordine: 10, visibileCliente: false };

describe("allegati email: cartella di destinazione", () => {
  it("propone una cartella riservata allo studio, mai una che il cliente vede", () => {
    assert.equal(cartellaProposta([fatture, altro, riservata]), "f-riservata");
  });

  it("se tutte le cartelle sono visibili al cliente non propone nulla", () => {
    // prima veniva scelta «Altro», che il cliente vede nel portale
    assert.equal(cartellaProposta([fatture, altro]), null);
  });

  it("senza scelta e senza cartelle riservate chiede di scegliere invece di indovinare", () => {
    const r = cartellaDiSalvataggio(undefined, [fatture, altro]);
    assert.equal(r.ok, false);
    assert.match(!r.ok ? r.errore : "", /Scegli la cartella/);
  });

  it("senza scelta usa la cartella riservata", () => {
    assert.deepEqual(cartellaDiSalvataggio(undefined, [fatture, riservata]), { ok: true, folderId: "f-riservata" });
  });

  it("rispetta la scelta esplicita, anche di una cartella visibile", () => {
    assert.deepEqual(cartellaDiSalvataggio("f-fatture", [fatture, riservata]), { ok: true, folderId: "f-fatture" });
  });

  it("rifiuta una cartella di un altro cliente", () => {
    assert.deepEqual(cartellaDiSalvataggio("f-di-un-altro", [fatture]), { ok: false, errore: "Cartella non valida." });
  });

  it("un cliente senza cartelle salva senza cartella (resta visibile solo allo studio)", () => {
    assert.deepEqual(cartellaDiSalvataggio(undefined, []), { ok: true, folderId: null });
  });

  it("l'ordine non dipende dal database: a parità di ordine decide il nome, poi l'id", () => {
    const a = { id: "b", nome: "Zeta", ordine: 0, visibileCliente: false };
    const b = { id: "a", nome: "Alfa", ordine: 0, visibileCliente: false };
    const c = { id: "c", nome: "Alfa", ordine: 0, visibileCliente: false };
    assert.deepEqual(ordinaCartelle([a, c, b]).map((x) => x.id), ["a", "c", "b"]);
    assert.equal(cartellaProposta([a, c, b]), "a");
  });
});
