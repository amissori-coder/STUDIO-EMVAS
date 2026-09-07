import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday, differenceInCalendarDays } from "date-fns";
import { it } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

/** Unisce classi Tailwind risolvendo i conflitti (l'ultima vince, es. "inline-flex" + "hidden" -> "hidden"). */
export function cn(...classes: (string | false | null | undefined)[]) {
  return twMerge(classes.filter(Boolean).join(" "));
}

export function formatDate(d: Date | string | null | undefined, pattern = "dd/MM/yyyy") {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return format(date, pattern, { locale: it });
}

export function formatDateTime(d: Date | string | null | undefined) {
  return formatDate(d, "dd/MM/yyyy HH:mm");
}

export function formatDateLong(d: Date | string | null | undefined) {
  return formatDate(d, "EEEE d MMMM yyyy");
}

export function formatRelative(d: Date | string | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isToday(date)) return `oggi alle ${format(date, "HH:mm")}`;
  if (isYesterday(date)) return `ieri alle ${format(date, "HH:mm")}`;
  if (isTomorrow(date)) return "domani";
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: it });
}

/** Descrizione della scadenza: "scaduta da 3 giorni", "oggi", "tra 5 giorni" */
export function describeDeadline(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = differenceInCalendarDays(date, new Date());
  if (diff === 0) return "oggi";
  if (diff === 1) return "domani";
  if (diff === -1) return "ieri";
  if (diff < 0) return `scaduta da ${-diff} giorni`;
  return `tra ${diff} giorni`;
}

export function daysUntil(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return differenceInCalendarDays(date, new Date());
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** Data (solo giorno) in formato ISO yyyy-MM-dd, per input type=date */
export function toDateInputValue(d: Date | string | null | undefined) {
  if (!d) return "";
  return formatDate(d, "yyyy-MM-dd");
}

/** Converte il valore di un input type=date in Date a mezzogiorno locale (evita slittamenti di fuso). */
export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

export function startOfDayLocal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function endOfDayLocal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function normalizeEmail(e: string | null | undefined) {
  return (e ?? "").trim().toLowerCase();
}

export function truncate(s: string | null | undefined, n = 80) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function slugifyFilename(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 120) || "file";
}
