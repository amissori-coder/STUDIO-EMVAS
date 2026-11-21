import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clientiFuoriGestione, messaggioFuoriGestione } from "../../src/modules/clienti/regole-portale";

const giulia = { id: "u-giulia", ruolo: "COLLABORATORE" };
const admin = { id: "u-admin", ruolo: "ADMIN" };
const bar = { clientId: "c-bar", denominazione: "Bar Centrale", referenteId: "u-giulia" };
const rossi = { clientId: "c-rossi", denominazione: "Rossi Impianti S.r.l.", referenteId: "u-admin" };
const senzaReferente = { clientId: "c-zeta", denominazione: "Zeta S.r.l.", referenteId: null };

describe("portale: password e attivazione di un utente collegato a più aziende", () => {
  it("il referente di una sola azienda NON può gestire un utente che accede anche ad altre", () => {
    // È lo scenario riprodotto dalla revisione: Giulia, referente del solo Bar Centrale, reimpostava
    // la password di Mario Rossi ed entrava nel portale vedendo i documenti di Rossi Impianti.
    const fuori = clientiFuoriGestione(giulia, [bar, rossi]);
    assert.deepEqual(
      fuori.map((c) => c.denominazione),
      ["Rossi Impianti S.r.l."],
    );
  });

  it("il referente può gestire un utente collegato solo ai propri clienti", () => {
    assert.deepEqual(clientiFuoriGestione(giulia, [bar]), []);
    assert.deepEqual(clientiFuoriGestione(giulia, [bar, { ...rossi, referenteId: "u-giulia" }]), []);
  });

  it("un cliente senza referente non è gestito da un collaboratore", () => {
    assert.equal(clientiFuoriGestione(giulia, [bar, senzaReferente]).length, 1);
  });

  it("l'amministratore può sempre", () => {
    assert.deepEqual(clientiFuoriGestione(admin, [bar, rossi, senzaReferente]), []);
  });

  it("il messaggio nomina le altre aziende e indica cosa resta possibile", () => {
    const m = messaggioFuoriGestione("Mario Rossi", [rossi]);
    assert.match(m, /Mario Rossi accede al portale anche per «Rossi Impianti S\.r\.l\.»/);
    assert.match(m, /solo un amministratore/);
    assert.match(m, /scollegarlo/);
  });
});
