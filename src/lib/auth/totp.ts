import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Codici a tempo per la verifica in due passaggi (TOTP, RFC 6238: HMAC-SHA1, 6 cifre, passi di 30
 * secondi), compatibili con Google Authenticator, Microsoft Authenticator, Authy e simili.
 * Modulo puro, senza database: provato da tests/unit/totp.test.ts con i vettori ufficiali della RFC.
 */

export const SECONDI_PER_PASSO = 30;
export const CIFRE = 6;
/** Passi accettati prima e dopo quello corrente: tollera un orologio del telefono avanti o indietro di 30 secondi. */
export const TOLLERANZA_PASSI = 1;
export const EMITTENTE = "Studio EMVAS";

const ALFABETO_BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32(dati: Buffer): string {
  let bit = 0;
  let valore = 0;
  let out = "";
  for (const byte of dati) {
    valore = (valore << 8) | byte;
    bit += 8;
    while (bit >= 5) {
      out += ALFABETO_BASE32[(valore >>> (bit - 5)) & 31];
      bit -= 5;
    }
  }
  if (bit > 0) out += ALFABETO_BASE32[(valore << (5 - bit)) & 31];
  return out;
}

export function daBase32(testo: string): Buffer {
  const pulito = testo.toUpperCase().replace(/[\s=-]/g, "");
  let bit = 0;
  let valore = 0;
  const out: number[] = [];
  for (const c of pulito) {
    const i = ALFABETO_BASE32.indexOf(c);
    if (i < 0) throw new Error("Chiave non valida");
    valore = (valore << 5) | i;
    bit += 5;
    if (bit >= 8) {
      out.push((valore >>> (bit - 8)) & 255);
      bit -= 8;
    }
  }
  return Buffer.from(out);
}

/** Nuovo segreto: 20 byte casuali (160 bit, la lunghezza raccomandata per SHA-1). */
export function generaSegreto(): string {
  return base32(randomBytes(20));
}

/** Il segreto a gruppi di quattro, per chi lo digita a mano nell'app. */
export function segretoLeggibile(segreto: string) {
  return segreto.replace(/(.{4})/g, "$1 ").trim();
}

export function passoDi(ms: number) {
  return Math.floor(ms / 1000 / SECONDI_PER_PASSO);
}

/** Codice di un passo (HOTP, RFC 4226, sul contatore = passo). */
export function codiceDelPasso(segreto: string, passo: number): string {
  const contatore = Buffer.alloc(8);
  contatore.writeBigUInt64BE(BigInt(passo));
  const hmac = createHmac("sha1", daBase32(segreto)).update(contatore).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const numero = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** CIFRE;
  return numero.toString().padStart(CIFRE, "0");
}

export type EsitoTotp = { ok: true; passo: number } | { ok: false; motivo: "formato" | "errato" | "gia-usato" };

/**
 * Verifica un codice. `ultimoPasso` è il passo dell'ultimo codice accettato per questo utente: un codice
 * dello stesso passo o di uno precedente è rifiutato anche se giusto, così chi lo intercetta (o lo legge
 * da sopra la spalla) non può riusarlo nei 30 secondi in cui resta valido.
 */
export function verificaTotp(segreto: string, codice: string, opzioni: { adesso?: number; ultimoPasso?: number | null } = {}): EsitoTotp {
  const pulito = codice.replace(/\s/g, "");
  if (!new RegExp(`^\\d{${CIFRE}}$`).test(pulito)) return { ok: false, motivo: "formato" };
  const corrente = passoDi(opzioni.adesso ?? Date.now());
  for (let d = -TOLLERANZA_PASSI; d <= TOLLERANZA_PASSI; d++) {
    const passo = corrente + d;
    if (uguali(codiceDelPasso(segreto, passo), pulito)) {
      if (opzioni.ultimoPasso != null && passo <= opzioni.ultimoPasso) return { ok: false, motivo: "gia-usato" };
      return { ok: true, passo };
    }
  }
  return { ok: false, motivo: "errato" };
}

function uguali(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Indirizzo da trasformare in QR code: l'app lo legge e aggiunge l'account. */
export function indirizzoOtpauth(segreto: string, account: string, emittente = EMITTENTE) {
  const etichetta = encodeURIComponent(`${emittente}:${account}`);
  const p = new URLSearchParams({ secret: segreto, issuer: emittente, algorithm: "SHA1", digits: String(CIFRE), period: String(SECONDI_PER_PASSO) });
  return `otpauth://totp/${etichetta}?${p.toString().replace(/\+/g, "%20")}`;
}

// ---------------------------------------------------------------------------------------------------
// Codici di recupero: usa-e-getta, per entrare se il telefono è perso. Si conservano solo le impronte.

const ALFABETO_RECUPERO = "abcdefghjkmnpqrstuvwxyz23456789"; // senza 0/o, 1/l/i: si ricopiano a mano
export const NUMERO_CODICI_RECUPERO = 10;

export function generaCodiciRecupero(n = NUMERO_CODICI_RECUPERO): string[] {
  return Array.from({ length: n }, () => {
    const b = randomBytes(10);
    let s = "";
    for (let i = 0; i < 10; i++) s += ALFABETO_RECUPERO[b[i]! % ALFABETO_RECUPERO.length];
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
}

/** Forma canonica: minuscole, senza spazi né trattini (si accetta come l'utente lo ricopia). */
export function normalizzaCodiceRecupero(codice: string) {
  return codice.toLowerCase().replace(/[\s-]/g, "");
}

export function sembraCodiceRecupero(codice: string) {
  return /^[a-z0-9]{10}$/.test(normalizzaCodiceRecupero(codice)) && !/^\d+$/.test(normalizzaCodiceRecupero(codice));
}

export function impronta(codice: string) {
  return createHash("sha256").update(normalizzaCodiceRecupero(codice)).digest("hex");
}

/** Le impronte salvate (campo User.totpRecupero: separate da virgola). */
export function leggiImpronte(campo: string | null | undefined): string[] {
  return (campo ?? "").split(",").filter(Boolean);
}

/**
 * Usa un codice di recupero: restituisce il nuovo valore del campo senza quel codice, oppure null se il
 * codice non c'è (sbagliato o già usato).
 */
export function consumaCodiceRecupero(campo: string | null | undefined, codice: string): { campo: string; rimasti: number } | null {
  const impronte = leggiImpronte(campo);
  const cercata = impronta(codice);
  const i = impronte.findIndex((h) => uguali(h, cercata));
  if (i < 0) return null;
  const rimaste = impronte.filter((_, j) => j !== i);
  return { campo: rimaste.join(","), rimasti: rimaste.length };
}
