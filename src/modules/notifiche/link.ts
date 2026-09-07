/**
 * Un link di notifica è "interno" solo se è un percorso assoluto dell'app ("/attivita/…").
 * Vengono esclusi "//host" e "/\host": il parser URL dei browser (WHATWG) tratta la backslash
 * come slash, quindi `new URL("/\\evil.com", base)` diventerebbe un redirect esterno.
 */
export function isInternalLink(link: string | null | undefined): link is string {
  return !!link && /^\/(?![/\\])/.test(link);
}

/** Risolve un link interno rispetto alla richiesta corrente; null se il risultato uscirebbe dall'origine. */
export function resolveInternalLink(link: string | null | undefined, base: string | URL): URL | null {
  if (!isInternalLink(link)) return null;
  const baseUrl = new URL(base);
  const url = new URL(link, baseUrl);
  return url.origin === baseUrl.origin ? url : null;
}
