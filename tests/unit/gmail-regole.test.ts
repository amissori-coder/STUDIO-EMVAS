import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clienteUnivoco, giorniDaRecuperare, pianoImportazione } from "../../src/lib/gmail-regole";

describe("importazione Gmail: regole", () => {
  it("associa solo quando l'indirizzo porta a un unico cliente", () => {
    assert.equal(clienteUnivoco(["c1"]), "c1");
    assert.equal(clienteUnivoco(["c1", "c1"]), "c1", "stesso cliente da email e contatto");
    assert.equal(clienteUnivoco(["c1", "c2"]), null, "indirizzo condiviso fra due clienti");
    assert.equal(clienteUnivoco([]), null);
  });

  it("oltre il limite i messaggi restano per la volta successiva e il punto di ripresa non avanza", () => {
    const elencati = ["a", "b", "c", "d", "e"];
    const p = pianoImportazione(elencati, new Set(["a"]), 2);
    assert.deepEqual(p, { daScaricare: ["b", "c"], restanti: 2, avanza: false });
    // seconda esecuzione: b e c ora sono importati
    const p2 = pianoImportazione(elencati, new Set(["a", "b", "c"]), 2);
    assert.deepEqual(p2, { daScaricare: ["d", "e"], restanti: 0, avanza: true });
  });

  it("niente di nuovo: si avanza", () => {
    assert.deepEqual(pianoImportazione(["a", "a"], new Set(["a"]), 300), { daScaricare: [], restanti: 0, avanza: true });
    assert.deepEqual(pianoImportazione([], new Set(), 300), { daScaricare: [], restanti: 0, avanza: true });
  });

  it("dopo una lunga pausa recupera dall'ultima sincronizzazione completa, almeno una settimana", () => {
    const adesso = new Date("2026-11-21T10:00:00Z");
    assert.equal(giorniDaRecuperare(null, adesso, 30), 30);
    assert.equal(giorniDaRecuperare(new Date("2026-11-20T10:00:00Z"), adesso, 30), 7);
    assert.equal(giorniDaRecuperare(new Date("2026-09-01T10:00:00Z"), adesso, 30), 82);
  });
});

describe("importazione Gmail: messaggio per l'utente", () => {
  it("riassume con gli accordi giusti", async () => {
    const { riepilogoSincronizzazione } = await import("../../src/lib/gmail-regole");
    assert.deepEqual(riepilogoSincronizzazione([{ imported: 1, linked: 1, restanti: 0 }]), {
      ok: true,
      testo: "Sincronizzazione completata: 1 nuova email importata, 1 associata automaticamente a un cliente.",
    });
    assert.equal(
      riepilogoSincronizzazione([{ imported: 300, linked: 12, restanti: 45 }]).testo,
      "Sincronizzazione completata: 300 nuove email importate, 12 associate automaticamente a un cliente. Altre 45 email verranno importate nelle prossime sincronizzazioni.",
    );
    assert.match(riepilogoSincronizzazione([{ imported: 0, linked: 0, restanti: 1 }]).testo, /Un'altra email verrà importata/);
  });

  it("una sincronizzazione già in corso non è un errore della casella ma va detta", async () => {
    const { riepilogoSincronizzazione } = await import("../../src/lib/gmail-regole");
    assert.deepEqual(riepilogoSincronizzazione([{ imported: 0, linked: 0, restanti: 0, giaInCorso: true }]), {
      ok: false,
      testo: "Una sincronizzazione è già in corso: i nuovi messaggi compariranno fra pochi istanti.",
    });
    const misto = riepilogoSincronizzazione([{ imported: 2, linked: 0, restanti: 0 }, { imported: 0, linked: 0, restanti: 0, giaInCorso: true }]);
    assert.equal(misto.ok, true);
    assert.match(misto.testo, /già in sincronizzazione/);
  });

  it("gli errori prevalgono e dicono quante email sono comunque arrivate", async () => {
    const { riepilogoSincronizzazione } = await import("../../src/lib/gmail-regole");
    const r = riepilogoSincronizzazione([{ imported: 3, linked: 1, restanti: 0, error: "Token\nscaduto" }]);
    assert.deepEqual(r, { ok: false, testo: "Sincronizzazione con errori: Token scaduto (importate comunque 3 email)" });
  });
});
