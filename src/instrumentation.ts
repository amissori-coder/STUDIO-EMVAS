import { pianificatoreInternoAttivo } from "@/lib/cron/stato";
export async function register() {
  // Tutte le date dell'applicazione («oggi», scadenze, promemoria, cambio d'anno) si calcolano nell'ora
  // del server: senza TZ un server in UTC sposterebbe tutto di una o due ore, e a cavallo della
  // mezzanotte (o del primo gennaio) conterebbe il giorno o l'anno sbagliato. Docker e .env lo
  // impostano già; questo vale come rete di sicurezza per ogni altra installazione.
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.TZ) process.env.TZ = "Europe/Rome";
  if (process.env.NEXT_RUNTIME === "nodejs" && pianificatoreInternoAttivo() && process.env.NEXT_PHASE !== "phase-production-build") {
    const { startScheduler } = await import("./lib/cron/scheduler");
    startScheduler();
  }
}
