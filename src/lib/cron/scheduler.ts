import "server-only";
import cron from "node-cron";
import { eseguiJobGiornalieri, jobSincronizzaGmail } from "@/lib/cron/jobs";

const g = globalThis as unknown as { __emvasSchedulerStarted?: boolean };

/** Avvia i job pianificati nel processo del server (una sola volta). */
export function startScheduler() {
  if (g.__emvasSchedulerStarted) return;
  g.__emvasSchedulerStarted = true;
  const tz = process.env.TZ || "Europe/Rome";

  // Ogni giorno alle 07:30: promemoria scadenze + allerta assenze
  cron.schedule(
    "30 7 * * *",
    async () => {
      try {
        const r = await eseguiJobGiornalieri();
        console.log("[cron] job giornalieri:", JSON.stringify(r));
      } catch (e) {
        console.error("[cron] errore job giornalieri:", e);
      }
    },
    { timezone: tz },
  );

  // Ogni 10 minuti: sincronizzazione Gmail
  cron.schedule(
    "*/10 * * * *",
    async () => {
      try {
        await jobSincronizzaGmail();
      } catch (e) {
        console.error("[cron] errore sync Gmail:", e);
      }
    },
    { timezone: tz },
  );

  console.log("[cron] pianificatore avviato (fuso orario " + tz + ")");
}
