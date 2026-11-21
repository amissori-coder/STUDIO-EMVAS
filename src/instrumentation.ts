import { pianificatoreInternoAttivo } from "@/lib/cron/stato";
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && pianificatoreInternoAttivo() && process.env.NEXT_PHASE !== "phase-production-build") {
    const { startScheduler } = await import("./lib/cron/scheduler");
    startScheduler();
  }
}
