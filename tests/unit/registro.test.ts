import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  AZIONI,
  AZIONI_SENZA_AUTORE,
  autoreAssente,
  azioniDelGruppo,
  CODICI,
  differenze,
  etichettaAzione,
  GRUPPI,
  idCitati,
  leggiDettagli,
  sembraId,
} from "../../src/modules/registro/etichette";

function fileSorgente(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) return fileSorgente(p);
    return /\.tsx?$/.test(nome) ? [p] : [];
  });
}

/** Testo della chiamata audit(...) che inizia in `da`, fino alla parentesi che la chiude. */
function chiamata(testo: string, da: number) {
  let profondita = 0;
  for (let i = da; i < testo.length; i++) {
    if (testo[i] === "(") profondita++;
    else if (testo[i] === ")" && --profondita === 0) return testo.slice(da, i + 1);
  }
  return testo.slice(da);
}

/** Ogni chiamata ad audit() nel codice, con le operazioni che può registrare. */
function chiamateAudit() {
  const radice = join(import.meta.dirname, "../../src");
  const trovate: { dove: string; azioni: string[]; conAutore: boolean }[] = [];
  for (const file of fileSorgente(radice)) {
    if (file.endsWith(join("lib", "audit.ts"))) continue; // la definizione
    const testo = readFileSync(file, "utf8");
    for (const m of testo.matchAll(/(?<![A-Za-z.])audit\(/g)) {
      const inizioRiga = testo.lastIndexOf("\n", m.index) + 1;
      const primaNellaRiga = testo.slice(inizioRiga, m.index);
      if (/^\s*(\*|\/\*|\/\/)|\/\//.test(primaNellaRiga)) continue; // citata in un commento
      const corpo = chiamata(testo, m.index + "audit".length);
      const riga = testo.slice(0, m.index).split("\n").length;
      const espressione = /(?<![A-Za-z])azione:([^,\n]*(?:\?[^,\n]*)?)/.exec(corpo)?.[1] ?? "";
      // i letterali dopo «azione:», «?» o «:», non quelli confrontati (=== "RICHIESTA")
      const azioni = [...`azione:${espressione}`.matchAll(/(?:azione:|\?|:)\s*"([A-Z_]{3,})"/g)].map((x) => x[1]);
      trovate.push({ dove: `${file.slice(radice.length + 1)}:${riga}`, azioni, conAutore: /(?<![A-Za-z])userId:/.test(corpo) });
    }
  }
  return trovate;
}

describe("registro delle operazioni: etichette", () => {
  const chiamate = chiamateAudit();

  it("trova le chiamate ad audit() nel codice", () => {
    assert.ok(chiamate.length > 40, `trovate solo ${chiamate.length} chiamate: la ricerca non funziona più`);
  });

  it("ogni chiamata registra un'operazione scritta per esteso", () => {
    const senza = chiamate.filter((c) => c.azioni.length === 0).map((c) => c.dove);
    assert.deepEqual(senza, [], "azione non letterale: il test non può controllarne l'etichetta");
  });

  it("ogni operazione registrata ha la sua etichetta italiana", () => {
    const mancanti = chiamate.flatMap((c) => c.azioni.filter((a) => !(a in AZIONI)).map((a) => `${a} (${c.dove})`));
    assert.deepEqual(mancanti, []);
  });

  it("legge anche le due operazioni di un'espressione condizionale, non il valore confrontato", () => {
    const assenze = chiamate.find((c) => c.azioni.includes("ASSENZA_ANNULLATA"));
    assert.ok(assenze);
    assert.deepEqual(assenze.azioni, ["ASSENZA_ANNULLATA", "ASSENZA_ELIMINATA"]);
  });

  it("solo i tentativi di accesso si registrano senza autore", () => {
    // altrimenti una riga senza autore non direbbe più se è un tentativo o l'opera di un account eliminato
    const senzaAutore = chiamate.filter((c) => !c.conAutore).flatMap((c) => c.azioni.filter((a) => !AZIONI_SENZA_AUTORE.has(a)).map((a) => `${a} (${c.dove})`));
    assert.deepEqual(senzaAutore, []);
    assert.ok(chiamate.some((c) => !c.conAutore), "la ricerca delle chiamate senza autore non funziona più");
  });

  it("ogni gruppo esiste e ha almeno un'operazione", () => {
    for (const d of Object.values(AZIONI)) assert.ok(d.gruppo in GRUPPI);
    for (const g of Object.keys(GRUPPI)) assert.ok(azioniDelGruppo(g).length > 0, g);
    assert.deepEqual(azioniDelGruppo("inesistente"), []);
  });

  it("un'operazione sconosciuta diventa leggibile", () => {
    assert.equal(etichettaAzione("BACKUP_ESEGUITO").label, "Backup eseguito");
    assert.equal(etichettaAzione("TASK_CREATA").label, "Attività creata");
  });
});

describe("registro delle operazioni: autore e dettagli", () => {
  it("senza autore: un accesso fallito è un tentativo, il resto viene da un account eliminato", () => {
    assert.equal(autoreAssente("LOGIN_FALLITO"), "tentativo");
    assert.equal(autoreAssente("LOGIN_BLOCCATO"), "tentativo");
    // un accesso RIUSCITO senza autore è di una persona poi eliminata, non un tentativo
    assert.equal(autoreAssente("LOGIN"), "eliminato");
    assert.equal(autoreAssente("DOCUMENTO_CARICATO_CLIENTE"), "eliminato");
  });

  it("dettagli in JSON: letti come campi", () => {
    assert.deepEqual(leggiDettagli('{"email":"a@b.it","ip":"1.2.3.4"}'), { dati: { email: "a@b.it", ip: "1.2.3.4" }, troncati: false, grezzo: null });
    assert.deepEqual(leggiDettagli("42").dati, { valore: 42 });
    assert.deepEqual(leggiDettagli(null), { dati: null, troncati: false, grezzo: null });
  });

  it("dettagli troncati al salvataggio: mostrati come testo, segnalando il taglio", () => {
    const lungo = JSON.stringify({ note: "x".repeat(5000) }).slice(0, 4000);
    const r = leggiDettagli(lungo);
    assert.equal(r.dati, null);
    assert.equal(r.troncati, true);
    assert.equal(r.grezzo, lungo);
  });

  it("testo non JSON e corto: mostrato com'è, senza parlare di taglio", () => {
    assert.deepEqual(leggiDettagli("nota libera"), { dati: null, troncati: false, grezzo: "nota libera" });
  });
});

describe("registro delle operazioni: lettura dei dettagli", () => {
  const giulia = "cmhx1a2b3c4d5e6f7g8h9i0j1";
  const marco = "cmhx9z8y7x6w5v4u3t2s1r0q9";

  it("una modifica mostra solo i campi cambiati", () => {
    const d = differenze({
      prima: { titolo: "F24 ottobre", scadenza: "2026-11-16T11:00:00.000Z", assigneeId: giulia, priorita: "MEDIA" },
      dopo: { titolo: "F24 ottobre", scadenza: "2026-11-18T11:00:00.000Z", assigneeId: marco, priorita: "MEDIA" },
      emailScollegate: 2,
    });
    assert.deepEqual(d, [
      { campo: "scadenza", prima: "2026-11-16T11:00:00.000Z", dopo: "2026-11-18T11:00:00.000Z" },
      { campo: "assigneeId", prima: giulia, dopo: marco },
    ]);
  });

  it("un campo che compare o sparisce conta come cambiato; senza prima/dopo non è una modifica", () => {
    assert.deepEqual(differenze({ prima: { clientId: null }, dopo: { clientId: giulia } }), [{ campo: "clientId", prima: null, dopo: giulia }]);
    assert.deepEqual(differenze({ prima: { a: 1 }, dopo: { a: 1 } }), []);
    assert.equal(differenze({ da: "DA_FARE", a: "IN_CORSO" }), null);
    assert.equal(differenze(null), null);
  });

  it("raccoglie gli identificativi anche dentro prima/dopo e in «da»/«a»", () => {
    assert.deepEqual([...idCitati({ da: giulia, a: marco })].sort(), [giulia, marco].sort());
    assert.deepEqual([...idCitati({ prima: { assigneeId: giulia }, dopo: { assigneeId: null }, titolo: "x" })], [giulia]);
    assert.deepEqual([...idCitati({ email: "a@b.it", stato: "IN_CORSO", anno: 2026 })], []);
  });

  it("riconosce gli identificativi, non le parole né le email", () => {
    assert.ok(sembraId(giulia));
    assert.ok(!sembraId("IN_CORSO"));
    assert.ok(!sembraId("collaboratore@studio.local"));
    assert.ok(!sembraId("cartella"));
  });

  it("traduce stati, ruoli e priorità", () => {
    assert.equal(CODICI.IN_CORSO, "In corso");
    assert.equal(CODICI.ADMIN, "Amministratore");
    assert.equal(CODICI.RICHIESTA, "In attesa");
    assert.equal(CODICI.ALTA, "Alta");
  });
});
