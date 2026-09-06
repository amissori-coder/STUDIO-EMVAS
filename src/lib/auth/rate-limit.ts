/**
 * Limitatore di tentativi in memoria (finestra scorrevole). L'app gira in un singolo processo Node,
 * quindi una mappa in memoria è sufficiente; si azzera al riavvio del server.
 */
const g = globalThis as unknown as { __emvasRateLimit?: Map<string, number[]> };
const store = (g.__emvasRateLimit ??= new Map<string, number[]>());

export interface RateLimitResult {
  ok: boolean;
  /** secondi da attendere prima del prossimo tentativo (se bloccato) */
  retryAfterSec: number;
}

/** Verifica se `key` ha superato `max` tentativi negli ultimi `windowMs` millisecondi (senza registrare nulla). */
export function checkRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const hits = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length) store.set(key, hits);
  else store.delete(key);
  if (hits.length >= max) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)) };
  }
  return { ok: true, retryAfterSec: 0 };
}

/** Registra un tentativo (fallito) per `key`. */
export function recordAttempt(key: string, windowMs: number) {
  const now = Date.now();
  const hits = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  store.set(key, hits);
  // pulizia periodica per non far crescere la mappa
  if (store.size > 10_000) {
    for (const [k, v] of store) if (!v.some((t) => now - t < windowMs)) store.delete(k);
  }
}

/** Azzera i tentativi per `key` (es. dopo un login riuscito). */
export function resetRateLimit(key: string) {
  store.delete(key);
}

/** Indirizzo IP del client (dietro reverse proxy: X-Forwarded-For / X-Real-IP). */
export function clientIpFromHeaders(h: { get(name: string): string | null }) {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim() || "sconosciuto";
  return h.get("x-real-ip")?.trim() || "sconosciuto";
}

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_PER_EMAIL = 10;
export const LOGIN_MAX_PER_IP = 50;
