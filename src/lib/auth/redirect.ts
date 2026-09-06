/**
 * Validazione dei percorsi di ritorno dopo il login ("next").
 * Accetta solo percorsi interni assoluti: niente "//host", niente backslash (il parser URL dei browser
 * tratta "/\evil.com" come "//evil.com"), niente caratteri di controllo o schemi.
 */
export function isSafeInternalPath(next: string | null | undefined): next is string {
  if (!next || typeof next !== "string") return false;
  if (next.length > 2000) return false;
  if (!/^\/(?![/\\])/.test(next)) return false;
  if (/[\\\x00-\x1f\x7f]/.test(next)) return false;
  try {
    const base = "http://localhost";
    const url = new URL(next, base);
    if (url.origin !== base) return false;
    // il percorso risolto deve coincidere con quello richiesto (nessuna normalizzazione sorprendente)
    if (url.pathname !== next.split(/[?#]/)[0]) return false;
  } catch {
    return false;
  }
  return true;
}

/** Restituisce `next` se è un percorso interno sicuro, altrimenti `fallback`. */
export function safeInternalPath(next: string | null | undefined, fallback: string) {
  return isSafeInternalPath(next) ? next : fallback;
}
