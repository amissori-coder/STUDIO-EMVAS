// Tipi e helper puri del modulo documenti (utilizzabili sia lato server sia lato client).

/** Estensioni ammesse per l'upload dal portale e dallo staff (input accept). */
export const UPLOAD_ACCEPT = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".heic",
  ".heif",
  ".tif",
  ".tiff",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".odt",
  ".ods",
  ".odp",
  ".rtf",
  ".txt",
  ".csv",
  ".xml",
  ".zip",
  ".7z",
  ".rar",
  ".p7m",
  ".eml",
  ".msg",
].join(",");

/** Limite predefinito dei file per singolo caricamento. */
export const MAX_FILES_PER_UPLOAD = 10; // allineato a experimental.proxyClientMaxBodySize in next.config.ts

/** Estensioni con MIME noto: usata quando il browser non fornisce un tipo affidabile. */
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  tif: "image/tiff",
  tiff: "image/tiff",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  rtf: "application/rtf",
  txt: "text/plain",
  csv: "text/csv",
  xml: "application/xml",
  zip: "application/zip",
  "7z": "application/x-7z-compressed",
  rar: "application/vnd.rar",
  p7m: "application/pkcs7-mime",
  eml: "message/rfc822",
  msg: "application/vnd.ms-outlook",
};

export function extensionOf(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

const MIME_PATTERN = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/;

/** Restituisce il MIME se sintatticamente valido, altrimenti application/octet-stream (evita header malformati). */
export function safeMimeType(mime: string | null | undefined) {
  const m = (mime ?? "").trim().toLowerCase();
  return m && MIME_PATTERN.test(m) ? m : "application/octet-stream";
}

/**
 * MIME type da usare per un file caricato: per le estensioni note vale sempre quello dedotto dall'estensione
 * (il tipo dichiarato dal browser non è affidabile: un "foto.jpg" dichiarato image/svg+xml non deve
 * essere servito come SVG); per le altre estensioni si usa il tipo dichiarato se plausibile.
 */
export function guessMimeType(name: string, provided?: string | null) {
  const byExt = MIME_BY_EXT[extensionOf(name)];
  if (byExt) return byExt;
  return safeMimeType(provided);
}

/**
 * Tipi che si aprono direttamente nel browser (Content-Disposition inline): solo PDF e immagini raster.
 * Tutto il resto (in particolare SVG, HTML e XML, che possono contenere script eseguiti nell'origine
 * dell'applicazione) viene servito come allegato da scaricare.
 */
const INLINE_MIMES = new Set(["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"]);

export function isInlineMime(mime: string) {
  return INLINE_MIMES.has(mime);
}

export type FileKind = "pdf" | "image" | "sheet" | "doc" | "archive" | "xml" | "other";

export function fileKind(name: string, mime: string): FileKind {
  const ext = extensionOf(name);
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (["xls", "xlsx", "ods", "csv"].includes(ext) || mime.includes("spreadsheet") || mime.includes("excel")) return "sheet";
  if (["doc", "docx", "odt", "rtf", "txt"].includes(ext) || mime.includes("word") || mime.startsWith("text/")) return "doc";
  if (["zip", "7z", "rar"].includes(ext) || mime.includes("zip") || mime.includes("compressed")) return "archive";
  if (["xml", "p7m"].includes(ext) || mime.includes("xml")) return "xml";
  return "other";
}

/** Documento serializzato per i componenti client. */
export interface DocumentDto {
  id: string;
  clientId: string;
  folderId: string | null;
  nome: string;
  mimeType: string;
  size: number;
  daCliente: boolean;
  note: string | null;
  createdAt: string; // ISO
  /** data/ora formattata sul server (fuso dello studio): i client component la usano così com'è, senza riformattarla */
  createdAtLabel: string;
  uploadedBy: { id: string; nome: string } | null;
  email: { id: string; subject: string } | null;
  task: { id: string; titolo: string } | null;
}

/** Cartella serializzata (piatta, con parentId) per i componenti client. */
export interface FolderDto {
  id: string;
  clientId: string;
  nome: string;
  descrizione: string | null;
  parentId: string | null;
  visibileCliente: boolean;
  clientePuoCaricare: boolean;
  ordine: number;
  /** numero di documenti direttamente nella cartella */
  count: number;
}

export interface FolderNode extends FolderDto {
  children: FolderNode[];
}

/** Costruisce l'albero dalle cartelle piatte (ordinate per ordine, nome). */
export function buildFolderTree(folders: FolderDto[]): FolderNode[] {
  const byId = new Map<string, FolderNode>();
  for (const f of folders) byId.set(f.id, { ...f, children: [] });
  const roots: FolderNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortNodes = (list: FolderNode[]) => {
    list.sort((a, b) => a.ordine - b.ordine || a.nome.localeCompare(b.nome, "it"));
    for (const n of list) sortNodes(n.children);
  };
  sortNodes(roots);
  return roots;
}

/** Numero totale di documenti in una cartella e nelle sue sottocartelle. */
export function countDeep(node: FolderNode): number {
  return node.count + node.children.reduce((s, c) => s + countDeep(c), 0);
}

/** Risposta della POST /api/documenti/upload */
export interface UploadResponse {
  ok?: boolean;
  error?: string;
  documenti?: DocumentDto[];
  /** nomi dei file che non è stato possibile salvare (risposta 207) */
  falliti?: string[];
}

const BLOCKED_EXT = new Set(["exe", "bat", "cmd", "com", "msi", "scr", "ps1", "sh", "js", "vbs", "jar"]);

/** Controllo lato client speculare a isAllowedFilename di lib/storage. */
export function hasBlockedExtension(name: string) {
  return BLOCKED_EXT.has(extensionOf(name));
}
