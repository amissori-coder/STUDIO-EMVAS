// Calendario fiscale italiano: festività nazionali e slittamento al primo giorno lavorativo.

/** Calcolo della Pasqua (algoritmo di Meeus/Jones/Butcher, calendario gregoriano). */
export function pasqua(anno: number): Date {
  const a = anno % 19;
  const b = Math.floor(anno / 100);
  const c = anno % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = aprile
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anno, mese - 1, giorno, 12);
}

function key(d: Date) {
  return `${d.getMonth() + 1}-${d.getDate()}`;
}

/** Festività nazionali italiane per un anno (chiave "mese-giorno"). */
export function festivita(anno: number): Set<string> {
  const p = pasqua(anno);
  const lunediAngelo = new Date(p);
  lunediAngelo.setDate(p.getDate() + 1);
  return new Set([
    "1-1", // Capodanno
    "1-6", // Epifania
    key(lunediAngelo), // Lunedì dell'Angelo
    "4-25", // Liberazione
    "5-1", // Festa del lavoro
    "6-2", // Festa della Repubblica
    "8-15", // Ferragosto
    "11-1", // Ognissanti
    "12-8", // Immacolata
    "12-25", // Natale
    "12-26", // Santo Stefano
  ]);
}

export function isFestivo(d: Date) {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return true;
  return festivita(d.getFullYear()).has(key(d));
}

/** Se la data cade di sabato, domenica o festivo, la sposta al primo giorno lavorativo successivo. */
export function primoGiornoLavorativo(d: Date): Date {
  const r = new Date(d);
  let guard = 0;
  while (isFestivo(r) && guard++ < 10) r.setDate(r.getDate() + 1);
  return r;
}

/** Ultimo giorno del mese (1-12). */
export function ultimoGiornoMese(anno: number, mese: number) {
  return new Date(anno, mese, 0).getDate();
}

export const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];
