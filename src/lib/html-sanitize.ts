/**
 * Sanificazione HTML basata su un tokenizer che segue le regole del parser HTML (stati "attribute name",
 * "attribute value quoted/unquoted", commenti, elementi raw text): l'output viene ricostruito in forma
 * canonica (attributi tra virgolette doppie, valori con `"` codificato), quindi non può essere
 * reinterpretato diversamente dal browser. Nessuna dipendenza esterna.
 *
 * Regole:
 *  - elementi rimossi con tutto il contenuto: script, style, template, xmp, noembed, noframes, iframe;
 *  - tag rimossi (contenuto mantenuto): object, embed, applet, form, meta, link, base, frame, frameset, svg, math;
 *  - attributi on* rimossi; attributi URL ammessi solo con schemi http, https, mailto, tel, cid
 *    (data:image/* solo in src); style rimosso se contiene expression/behavior/binding/javascript;
 *  - commenti e sezioni "bogus" rimossi.
 */

const RAW_TEXT_DROP = new Set(["script", "style", "template", "xmp", "noembed", "noframes", "iframe"]);
const TAG_DROP = new Set(["object", "embed", "applet", "form", "meta", "link", "base", "frame", "frameset", "svg", "math", "xml"]);
const URL_ATTRS = new Set([
  "href", "src", "srcset", "action", "formaction", "xlink:href", "background", "poster", "data",
  "dynsrc", "lowsrc", "codebase", "cite", "longdesc", "usemap", "ping", "manifest", "profile",
]);
const SAFE_SCHEMES = new Set(["http", "https", "mailto", "tel", "cid"]);

const NAMED_ENTITIES: Record<string, string> = {
  tab: "\t", newline: "\n", colon: ":", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", sol: "/", nbsp: " ",
};

export function decodeHtmlEntities(s: string) {
  return s
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => safeFromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => safeFromCodePoint(Number(d)))
    .replace(/&([a-z]+);?/gi, (m, n: string) => NAMED_ENTITIES[n.toLowerCase()] ?? m);
}

function safeFromCodePoint(n: number) {
  try {
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  } catch {
    return "";
  }
}

function isSafeUrl(value: string, attr: string) {
  const v = decodeHtmlEntities(value).replace(/[\x00-\x20\x7f]/g, "").toLowerCase();
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(v)?.[1];
  if (!scheme) return true; // relativo o solo ancora
  if (SAFE_SCHEMES.has(scheme)) return true;
  if (scheme === "data" && attr === "src" && v.startsWith("data:image/")) return true;
  return false;
}

function isSafeSrcset(value: string) {
  return value.split(",").every((c) => isSafeUrl(c.trim().split(/\s+/)[0] ?? "", "src"));
}

function isSafeStyle(value: string) {
  const v = decodeHtmlEntities(value).replace(/\s+/g, "").toLowerCase();
  return !/expression\(|behavior:|-moz-binding|javascript:|vbscript:/.test(v);
}

function escapeAttr(v: string) {
  return v.replace(/&(?![a-zA-Z]+;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;").replace(/"/g, "&quot;");
}

interface Attr { name: string; value: string | null }

const WS = /[\t\n\f\r ]/;

/** Legge un tag a partire da `i` (posizione di "<"); restituisce fine, nome, attributi ed eventuale chiusura. */
function readTag(html: string, start: number): { end: number; name: string; closing: boolean; attrs: Attr[]; truncated?: boolean } | null {
  let i = start + 1;
  let closing = false;
  if (html[i] === "/") {
    closing = true;
    i++;
  }
  if (!/[a-zA-Z]/.test(html[i] ?? "")) return null;
  let name = "";
  while (i < html.length && !WS.test(html[i]!) && html[i] !== "/" && html[i] !== ">") name += html[i++];
  name = name.toLowerCase();
  const attrs: Attr[] = [];
  // before attribute name
  while (i < html.length) {
    const ch = html[i]!;
    if (WS.test(ch) || ch === "/") { i++; continue; }
    if (ch === ">") return { end: i + 1, name, closing, attrs };
    // attribute name
    let aname = "";
    while (i < html.length && !WS.test(html[i]!) && html[i] !== "/" && html[i] !== ">" && html[i] !== "=") aname += html[i++];
    if (!aname && html[i] === "=") { aname = "="; i++; } // parse error: "=" come nome
    // after attribute name
    while (i < html.length && WS.test(html[i]!)) i++;
    if (html[i] !== "=") { attrs.push({ name: aname.toLowerCase(), value: null }); continue; }
    i++; // "="
    while (i < html.length && WS.test(html[i]!)) i++;
    const q = html[i];
    let value = "";
    if (q === '"' || q === "'") {
      const close = html.indexOf(q, i + 1);
      if (close < 0) return { end: html.length, name, closing, attrs, truncated: true }; // EOF nel valore: il tag viene scartato dal browser
      value = html.slice(i + 1, close);
      i = close + 1;
    } else if (q === ">") {
      attrs.push({ name: aname.toLowerCase(), value: "" });
      return { end: i + 1, name, closing, attrs };
    } else {
      while (i < html.length && !WS.test(html[i]!) && html[i] !== ">") value += html[i++];
    }
    attrs.push({ name: aname.toLowerCase(), value });
  }
  return { end: html.length, name, closing, attrs, truncated: true }; // EOF nel tag: scartato
}

function cleanAttrs(attrs: Attr[]): string {
  let out = "";
  const seen = new Set<string>();
  for (const a of attrs) {
    const name = a.name;
    if (!name || seen.has(name) || !/^[a-z][a-z0-9_:.-]*$/.test(name)) continue;
    if (name.startsWith("on")) continue;
    if (name === "srcdoc" || name === "xmlns" || name === "contenteditable" || name === "formaction") continue;
    if (a.value === null) { seen.add(name); out += ` ${name}`; continue; }
    if (name === "srcset" || name === "imagesrcset") { if (!isSafeSrcset(a.value)) continue; }
    else if (URL_ATTRS.has(name)) { if (!isSafeUrl(a.value, name)) continue; }
    else if (name === "style") { if (!isSafeStyle(a.value)) continue; }
    seen.add(name);
    out += ` ${name}="${escapeAttr(a.value)}"`;
  }
  return out;
}

/** Sanifica un frammento HTML (vedi regole in testa al file). */
export function sanitizeHtml(html: string): string {
  let out = "";
  let i = 0;
  const n = html.length;
  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt < 0) { out += html.slice(i); break; }
    out += html.slice(i, lt);
    const next = html[lt + 1] ?? "";
    if (next === "!" || next === "?") {
      // commento o "bogus comment"
      if (html.startsWith("<!--", lt)) {
        const m = /-->|--!>/g;
        m.lastIndex = lt + 4;
        const r = m.exec(html);
        i = r ? r.index + r[0].length : n;
      } else {
        const gt = html.indexOf(">", lt + 2);
        i = gt < 0 ? n : gt + 1;
      }
      continue;
    }
    if (next === "/" && !/[a-zA-Z]/.test(html[lt + 2] ?? "")) {
      // "</>" viene ignorato; "</ x" è un bogus comment fino a ">"
      if (html[lt + 2] === ">") { i = lt + 3; continue; }
      const gt = html.indexOf(">", lt + 2);
      i = gt < 0 ? n : gt + 1;
      continue;
    }
    const tag = readTag(html, lt);
    if (!tag) { out += "&lt;"; i = lt + 1; continue; }
    i = tag.end;
    if (tag.truncated) continue; // tag troncato a fine documento
    if (!/^[a-z][a-z0-9-]*$/.test(tag.name)) continue; // nome non valido (es. "scr<script"): scartato
    if (RAW_TEXT_DROP.has(tag.name)) {
      if (!tag.closing) {
        // salta tutto il contenuto raw text fino al tag di chiusura
        const re = new RegExp(`</${tag.name}[\\t\\n\\f\\r />]`, "gi");
        re.lastIndex = tag.end;
        const r = re.exec(html);
        if (!r) { i = n; continue; }
        const gt = html.indexOf(">", r.index);
        i = gt < 0 ? n : gt + 1;
      }
      continue;
    }
    if (TAG_DROP.has(tag.name)) continue;
    if (tag.closing) { out += `</${tag.name}>`; continue; }
    out += `<${tag.name}${cleanAttrs(tag.attrs)}>`;
  }
  return out;
}
