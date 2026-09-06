import type { ReactNode } from "react";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const URL_PATTERN = `https?:\\/\\/[^\\s<>"']*[^\\s<>"'.,;:!?)]`;

/**
 * Costruisce l'espressione regolare che riconosce URL e menzioni "@Nome Cognome"
 * (i nomi più lunghi hanno la precedenza per evitare corrispondenze parziali).
 */
export function buildMessageRegex(staffNames: string[]) {
  const names = Array.from(new Set(staffNames.map((n) => n.trim()).filter(Boolean)))
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  const mention = names.length ? `|(@(?:${names.join("|")}))(?![\\p{L}\\p{N}])` : "";
  return new RegExp(`(${URL_PATTERN})${mention}`, "giu");
}

/**
 * Trasforma il testo di un messaggio in nodi React: i ritorni a capo sono preservati dal CSS
 * (whitespace-pre-wrap), gli URL diventano link che si aprono in una nuova scheda, le menzioni
 * sono evidenziate. L'HTML non viene mai interpretato (React fa l'escape del testo).
 */
export function renderMessageText(testo: string, regex: RegExp, opts: { own?: boolean } = {}): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
  let last = 0;
  let key = 0;
  for (const m of testo.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) nodes.push(testo.slice(last, idx));
    const [full, url, mention] = m;
    if (url) {
      nodes.push(
        <a
          key={key++}
          href={url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={opts.own ? "underline decoration-white/60 hover:decoration-white" : "text-blue-700 underline hover:text-blue-900"}
        >
          {url}
        </a>,
      );
    } else if (mention) {
      nodes.push(
        <span
          key={key++}
          className={
            opts.own
              ? "rounded bg-white/25 px-1 font-semibold"
              : "rounded bg-amber-100 px-1 font-semibold text-amber-900"
          }
        >
          {mention}
        </span>,
      );
    } else {
      nodes.push(full);
    }
    last = idx + full.length;
  }
  if (last < testo.length) nodes.push(testo.slice(last));
  return nodes;
}
