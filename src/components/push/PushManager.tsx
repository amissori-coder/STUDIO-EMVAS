"use client";
import { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import { Button } from "@/components/ui/Button";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Attiva/disattiva le notifiche push del browser per l'utente corrente. */
export function PushManager() {
  const [env, setEnv] = useState<{ supported: boolean; isIOS: boolean; standalone: boolean } | null>(null);
  const [sub, setSub] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && !!vapid;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
      let current: PushSubscription | null = null;
      if (supported) {
        try {
          const reg = await navigator.serviceWorker.ready;
          current = await reg.pushManager.getSubscription();
        } catch {
          current = null;
        }
      }
      if (!cancelled) {
        setEnv({ supported, isIOS, standalone });
        setSub(current);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vapid]);

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("Permesso per le notifiche negato dal browser.");
      const reg = await navigator.serviceWorker.ready;
      const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid!) });
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s.toJSON()) });
      if (!res.ok) throw new Error("Registrazione della sottoscrizione fallita.");
      setSub(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setSub(null);
    } finally {
      setBusy(false);
    }
  }

  if (!env) return null;
  const { supported, isIOS, standalone } = env;
  if (!supported) {
    return (
      <p className="text-sm text-slate-500">
        {!vapid
          ? "Le notifiche push non sono configurate sul server (chiavi VAPID mancanti)."
          : isIOS && !standalone
            ? "Su iPhone/iPad aggiungi prima l'app alla schermata Home (Condividi → Aggiungi alla schermata Home), poi attiva le notifiche da qui."
            : "Questo browser non supporta le notifiche push."}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {sub ? (
          <Button variant="outline" onClick={unsubscribe} disabled={busy}>
            <BellOff className="h-4 w-4" /> Disattiva notifiche su questo dispositivo
          </Button>
        ) : (
          <Button onClick={subscribe} disabled={busy}>
            <BellRing className="h-4 w-4" /> Attiva notifiche su questo dispositivo
          </Button>
        )}
        <span className="text-sm text-slate-500">{sub ? "Notifiche push attive." : "Riceverai avvisi anche ad app chiusa."}</span>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {isIOS && !standalone && (
        <p className="text-xs text-slate-500">Su iPhone/iPad le notifiche funzionano solo con l&apos;app aggiunta alla schermata Home.</p>
      )}
    </div>
  );
}
