import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chiaveConferma, descriviCampi, duplicatiConfermati, messaggioDuplicati, raggruppaDuplicati, valoriDaControllare } from "../../src/modules/clienti/duplicati";

const CF = "RSSMRA80A01H501U";
const PIVA = "01234567890";

describe("clienti doppi per codice fiscale e partita IVA", () => {
  it("alla creazione si controllano i valori presenti", () => {
    assert.deepEqual(valoriDaControllare({ codiceFiscale: CF, partitaIva: PIVA }), [CF, PIVA]);
    assert.deepEqual(valoriDaControllare({ codiceFiscale: null, partitaIva: PIVA }), [PIVA]);
    // società: codice fiscale uguale alla partita IVA, un solo valore
    assert.deepEqual(valoriDaControllare({ codiceFiscale: PIVA, partitaIva: PIVA }), [PIVA]);
  });

  it("in modifica solo i campi cambiati: un doppione già accettato non blocca il salvataggio di altro", () => {
    const prima = { codiceFiscale: CF, partitaIva: PIVA };
    assert.deepEqual(valoriDaControllare({ codiceFiscale: CF, partitaIva: PIVA }, prima), []);
    assert.deepEqual(valoriDaControllare({ codiceFiscale: CF, partitaIva: "09876543210" }, prima), ["09876543210"]);
    assert.deepEqual(valoriDaControllare({ codiceFiscale: null, partitaIva: PIVA }, prima), [], "svuotare un campo non è un doppione");
  });

  it("trova il valore anche nel campo opposto di un altro cliente", () => {
    const altri = [
      { id: "a", denominazione: "Rossi Mario", attivo: true, codiceFiscale: CF, partitaIva: null },
      { id: "b", denominazione: "Rossi Srl", attivo: false, codiceFiscale: PIVA, partitaIva: null },
    ];
    const d = raggruppaDuplicati({ codiceFiscale: CF, partitaIva: PIVA }, [CF, PIVA], altri);
    assert.deepEqual(d, [
      { valore: CF, campi: ["codiceFiscale"], clienti: [{ id: "a", denominazione: "Rossi Mario", attivo: true }] },
      { valore: PIVA, campi: ["partitaIva"], clienti: [{ id: "b", denominazione: "Rossi Srl", attivo: false }] },
    ]);
    assert.equal(descriviCampi(d[0]!), "Codice fiscale");
    assert.equal(descriviCampi({ valore: PIVA, campi: ["codiceFiscale", "partitaIva"], clienti: [] }), "Codice fiscale e partita IVA");
    assert.equal(messaggioDuplicati(d), "Esistono già 2 clienti con lo stesso codice fiscale e la stessa partita IVA. Controlla che non sia un doppione; se è davvero un cliente diverso, conferma e salva di nuovo.");
  });

  it("la conferma vale per i doppioni confermati, non per altri comparsi dopo", () => {
    const d1 = raggruppaDuplicati({ codiceFiscale: CF, partitaIva: null }, [CF], [{ id: "a", denominazione: "A", attivo: true, codiceFiscale: CF, partitaIva: null }]);
    const chiave = chiaveConferma(d1);
    assert.equal(chiave, CF);
    assert.ok(duplicatiConfermati(chiave, d1));
    const d2 = raggruppaDuplicati({ codiceFiscale: CF, partitaIva: PIVA }, [CF, PIVA], [
      { id: "a", denominazione: "A", attivo: true, codiceFiscale: CF, partitaIva: null },
      { id: "b", denominazione: "B", attivo: true, codiceFiscale: null, partitaIva: PIVA },
    ]);
    assert.ok(!duplicatiConfermati(chiave, d2), "la partita IVA doppia va confermata a parte");
    assert.ok(duplicatiConfermati(chiaveConferma(d2), d2));
    assert.equal(messaggioDuplicati(d1), "Esiste già un cliente con lo stesso codice fiscale. Controlla che non sia un doppione; se è davvero un cliente diverso, conferma e salva di nuovo.");
  });
});
