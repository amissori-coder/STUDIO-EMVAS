import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  base32,
  codiceDelPasso,
  consumaCodiceRecupero,
  daBase32,
  generaCodiciRecupero,
  generaSegreto,
  impronta,
  indirizzoOtpauth,
  leggiImpronte,
  passoDi,
  segretoLeggibile,
  sembraCodiceRecupero,
  verificaTotp,
} from "../../src/lib/auth/totp";

// Vettori della RFC 6238 (appendice B), SHA-1, segreto ASCII "12345678901234567890": le ultime 6 cifre
const SEGRETO_RFC = base32(Buffer.from("12345678901234567890"));
const VETTORI: [number, string][] = [
  [59, "287082"],
  [1111111109, "081804"],
  [1111111111, "050471"],
  [1234567890, "005924"],
  [2000000000, "279037"],
  [20000000000, "353130"],
];

describe("codici a tempo (TOTP)", () => {
  it("rispetta i vettori ufficiali della RFC 6238", () => {
    for (const [secondi, atteso] of VETTORI) assert.equal(codiceDelPasso(SEGRETO_RFC, passoDi(secondi * 1000)), atteso, `t=${secondi}`);
  });

  it("base32 va e torna, ignorando spazi, minuscole e trattini", () => {
    const b = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 7]);
    assert.deepEqual(daBase32(base32(b)), b);
    const s = generaSegreto();
    assert.equal(s.length, 32);
    assert.deepEqual(daBase32(segretoLeggibile(s).toLowerCase()), daBase32(s));
    assert.throws(() => daBase32("abc1"));
  });

  it("accetta il codice corrente e quelli di 30 secondi prima o dopo, non oltre", () => {
    const adesso = 1_800_000_000_000;
    const p = passoDi(adesso);
    assert.deepEqual(verificaTotp(SEGRETO_RFC, codiceDelPasso(SEGRETO_RFC, p), { adesso }), { ok: true, passo: p });
    assert.deepEqual(verificaTotp(SEGRETO_RFC, codiceDelPasso(SEGRETO_RFC, p - 1), { adesso }), { ok: true, passo: p - 1 });
    assert.deepEqual(verificaTotp(SEGRETO_RFC, codiceDelPasso(SEGRETO_RFC, p + 1), { adesso }), { ok: true, passo: p + 1 });
    assert.deepEqual(verificaTotp(SEGRETO_RFC, codiceDelPasso(SEGRETO_RFC, p - 2), { adesso }), { ok: false, motivo: "errato" });
    assert.deepEqual(verificaTotp(SEGRETO_RFC, codiceDelPasso(SEGRETO_RFC, p + 2), { adesso }), { ok: false, motivo: "errato" });
  });

  it("rifiuta un codice già usato, anche se ancora valido", () => {
    const adesso = 1_800_000_000_000;
    const p = passoDi(adesso);
    const codice = codiceDelPasso(SEGRETO_RFC, p);
    assert.deepEqual(verificaTotp(SEGRETO_RFC, codice, { adesso, ultimoPasso: p }), { ok: false, motivo: "gia-usato" });
    // un codice di un passo precedente all'ultimo usato non torna valido
    assert.deepEqual(verificaTotp(SEGRETO_RFC, codiceDelPasso(SEGRETO_RFC, p - 1), { adesso, ultimoPasso: p }), { ok: false, motivo: "gia-usato" });
    // il codice del passo successivo invece sì
    assert.deepEqual(verificaTotp(SEGRETO_RFC, codiceDelPasso(SEGRETO_RFC, p + 1), { adesso, ultimoPasso: p }), { ok: true, passo: p + 1 });
  });

  it("controlla il formato prima di tutto", () => {
    assert.deepEqual(verificaTotp(SEGRETO_RFC, "12345"), { ok: false, motivo: "formato" });
    assert.deepEqual(verificaTotp(SEGRETO_RFC, "abcdef"), { ok: false, motivo: "formato" });
    const adesso = 1_800_000_000_000;
    const c = codiceDelPasso(SEGRETO_RFC, passoDi(adesso));
    assert.equal(verificaTotp(SEGRETO_RFC, `${c.slice(0, 3)} ${c.slice(3)}`, { adesso }).ok, true, "lo spazio in mezzo è ammesso");
  });

  it("l'indirizzo per il QR code contiene emittente, account e parametri", () => {
    const u = indirizzoOtpauth("JBSWY3DPEHPK3PXP", "mario@studio.it");
    assert.equal(u, "otpauth://totp/Studio%20EMVAS%3Amario%40studio.it?secret=JBSWY3DPEHPK3PXP&issuer=Studio%20EMVAS&algorithm=SHA1&digits=6&period=30");
  });
});

describe("codici di recupero", () => {
  it("sono dieci, diversi, leggibili e riconoscibili", () => {
    const codici = generaCodiciRecupero();
    assert.equal(codici.length, 10);
    assert.equal(new Set(codici).size, 10);
    for (const c of codici) {
      assert.match(c, /^[a-z2-9]{5}-[a-z2-9]{5}$/);
      assert.doesNotMatch(c, /[01oil]/);
      assert.ok(sembraCodiceRecupero(c));
      assert.ok(sembraCodiceRecupero(c.toUpperCase().replace("-", " ")));
    }
    assert.ok(!sembraCodiceRecupero("123456"));
    assert.ok(!sembraCodiceRecupero("1234567890"));
  });

  it("si conservano solo le impronte e ognuno vale una volta sola", () => {
    const codici = generaCodiciRecupero(3);
    const campo = codici.map(impronta).join(",");
    assert.ok(!campo.includes(codici[0]!.replace("-", "")));
    const primo = consumaCodiceRecupero(campo, codici[1]!.toUpperCase());
    assert.ok(primo);
    assert.equal(primo.rimasti, 2);
    assert.equal(leggiImpronte(primo.campo).length, 2);
    assert.equal(consumaCodiceRecupero(primo.campo, codici[1]!), null, "già usato");
    assert.equal(consumaCodiceRecupero(primo.campo, "zzzzz-zzzzz"), null, "inesistente");
    const ultimo = consumaCodiceRecupero(consumaCodiceRecupero(primo.campo, codici[0]!)!.campo, codici[2]!);
    assert.deepEqual(ultimo, { campo: "", rimasti: 0 });
    assert.deepEqual(leggiImpronte(""), []);
    assert.deepEqual(leggiImpronte(null), []);
  });
});
