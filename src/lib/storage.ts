import "server-only";
import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { slugifyFilename } from "@/lib/utils";

export function getDataDir() {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.DATA_DIR ?? "./data");
}

export function getUploadsDir() {
  return path.join(getDataDir(), "uploads");
}

export function getMaxUploadBytes() {
  const mb = Number(process.env.MAX_UPLOAD_MB ?? 25);
  return (Number.isFinite(mb) && mb > 0 ? mb : 25) * 1024 * 1024;
}

const BLOCKED_EXTENSIONS = new Set([".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".ps1", ".sh", ".js", ".vbs", ".jar"]);

export function isAllowedFilename(name: string) {
  const ext = path.extname(name).toLowerCase();
  return !BLOCKED_EXTENSIONS.has(ext);
}

/**
 * Salva un file nella cartella uploads/<clientId>/ e restituisce il percorso relativo
 * da memorizzare in Document.storagePath.
 */
export async function saveUpload(opts: { clientId: string; originalName: string; data: Buffer | Uint8Array }) {
  const safeName = slugifyFilename(opts.originalName);
  const rel = path.posix.join(opts.clientId, `${randomUUID()}-${safeName}`);
  const abs = path.join(getUploadsDir(), rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, opts.data);
  return rel;
}

/** Percorso assoluto di un file salvato; rifiuta percorsi che escono da uploads/. */
export function resolveUploadPath(storagePath: string) {
  const base = getUploadsDir();
  const abs = path.resolve(base, storagePath);
  if (!abs.startsWith(base + path.sep)) throw new Error("Percorso file non valido");
  return abs;
}

export async function readUpload(storagePath: string) {
  return fs.readFile(resolveUploadPath(storagePath));
}

export function streamUpload(storagePath: string) {
  return createReadStream(resolveUploadPath(storagePath));
}

export async function deleteUpload(storagePath: string) {
  try {
    await fs.unlink(resolveUploadPath(storagePath));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}

export async function uploadExists(storagePath: string) {
  try {
    await fs.access(resolveUploadPath(storagePath));
    return true;
  } catch {
    return false;
  }
}
