"use client";
import { useEffect } from "react";

/** Registra il service worker (necessario per le notifiche push e l'installazione come app). */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((e) => {
      console.warn("Service worker non registrato:", e);
    });
  }, []);
  return null;
}
