// Helper puri (senza accesso al DB) condivisi dal modulo Attività.
import type { Prisma } from "@prisma/client";
import { PRIORITA_TASK, STATI_TASK, STATI_TASK_APERTI, type StatoTask } from "@/lib/constants";
import { daysUntil, formatDate, formatDateLong } from "@/lib/utils";

export const TASK_LIST_INCLUDE = {
  client: { select: { id: true, denominazione: true } },
  assignee: { select: { id: true, nome: true, colore: true } },
  template: { select: { id: true, nome: true, categoria: true } },
} satisfies Prisma.TaskInclude;

export type TaskListItem = Prisma.TaskGetPayload<{ include: typeof TASK_LIST_INCLUDE }>;

export const PAGE_SIZE = 100;

export const PERIODI = {
  tutte: "Qualsiasi data",
  scadute: "Scadute",
  oggi: "Oggi",
  settimana: "Prossimi 7 giorni",
  mese: "Prossimi 30 giorni",
} as const;
export type Periodo = keyof typeof PERIODI;

export const ORDINAMENTI = {
  scadenza: "Scadenza",
  priorita: "Priorità",
  cliente: "Cliente",
} as const;
export type Ordinamento = keyof typeof ORDINAMENTI;

export interface TaskFilters {
  stato: "aperte" | "tutte" | StatoTask;
  assegnatario: string; // userId | "me" | "nessuno" | ""
  cliente: string;
  categoria: string;
  periodo: Periodo;
  ricerca: string;
  ordina: Ordinamento;
  pagina: number;
}

type SP = Record<string, string | string[] | undefined>;

function str(sp: SP, key: string) {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/** Legge i filtri dai searchParams applicando i default. */
export function parseTaskFilters(sp: SP): TaskFilters {
  const stato = str(sp, "stato");
  const periodo = str(sp, "periodo");
  const ordina = str(sp, "ordina");
  const pagina = Number.parseInt(str(sp, "pagina"), 10);
  return {
    stato: stato === "tutte" || stato in STATI_TASK ? (stato as TaskFilters["stato"]) : "aperte",
    assegnatario: str(sp, "assegnatario"),
    cliente: str(sp, "cliente"),
    categoria: str(sp, "categoria"),
    periodo: periodo in PERIODI ? (periodo as Periodo) : "tutte",
    ricerca: str(sp, "ricerca").trim().slice(0, 100),
    ordina: ordina in ORDINAMENTI ? (ordina as Ordinamento) : "scadenza",
    pagina: Number.isFinite(pagina) && pagina > 0 ? pagina : 1,
  };
}

/** Ricostruisce la query string dai filtri (omettendo i default). */
export function buildTaskQuery(f: Partial<TaskFilters>) {
  const p = new URLSearchParams();
  if (f.stato && f.stato !== "aperte") p.set("stato", f.stato);
  if (f.assegnatario) p.set("assegnatario", f.assegnatario);
  if (f.cliente) p.set("cliente", f.cliente);
  if (f.categoria) p.set("categoria", f.categoria);
  if (f.periodo && f.periodo !== "tutte") p.set("periodo", f.periodo);
  if (f.ricerca) p.set("ricerca", f.ricerca);
  if (f.ordina && f.ordina !== "scadenza") p.set("ordina", f.ordina);
  if (f.pagina && f.pagina > 1) p.set("pagina", String(f.pagina));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function isTaskAperta(stato: string) {
  return (STATI_TASK_APERTI as string[]).includes(stato);
}

export function isTaskScaduta(t: { stato: string; scadenza: Date }) {
  return isTaskAperta(t.stato) && daysUntil(t.scadenza) < 0;
}

const PRIORITA_ORDINE: Record<string, number> = { ALTA: 0, MEDIA: 1, BASSA: 2 };

export function ordinaTasks<T extends TaskListItem>(tasks: T[], ordina: Ordinamento): T[] {
  const byScadenza = (a: T, b: T) => a.scadenza.getTime() - b.scadenza.getTime();
  const copy = [...tasks];
  if (ordina === "priorita") {
    copy.sort((a, b) => (PRIORITA_ORDINE[a.priorita] ?? 9) - (PRIORITA_ORDINE[b.priorita] ?? 9) || byScadenza(a, b));
  } else if (ordina === "cliente") {
    copy.sort((a, b) => (a.client?.denominazione ?? "￿").localeCompare(b.client?.denominazione ?? "￿", "it") || byScadenza(a, b));
  } else {
    copy.sort(byScadenza);
  }
  return copy;
}

export interface TaskGroup<T> {
  key: string;
  label: string;
  scaduto: boolean;
  items: T[];
}

/**
 * Raggruppa le attività per giorno di scadenza: "Scadute" (solo attività aperte già scadute),
 * "Oggi", "Domani", altrimenti la data estesa.
 */
export function raggruppaPerGiorno<T extends { scadenza: Date; stato: string }>(tasks: T[]): TaskGroup<T>[] {
  const groups: TaskGroup<T>[] = [];
  const map = new Map<string, TaskGroup<T>>();
  for (const t of tasks) {
    const diff = daysUntil(t.scadenza);
    let key: string;
    let label: string;
    let scaduto = false;
    if (diff < 0 && isTaskAperta(t.stato)) {
      key = "scadute";
      label = "Scadute";
      scaduto = true;
    } else if (diff === 0) {
      key = "oggi";
      label = "Oggi";
    } else if (diff === 1) {
      key = "domani";
      label = "Domani";
    } else {
      key = formatDate(t.scadenza, "yyyy-MM-dd");
      label = capitalize(formatDateLong(t.scadenza));
    }
    let g = map.get(key);
    if (!g) {
      g = { key, label, scaduto, items: [] };
      map.set(key, g);
      groups.push(g);
    }
    g.items.push(t);
  }
  return groups;
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const PRIORITA_OPZIONI = Object.entries(PRIORITA_TASK) as [keyof typeof PRIORITA_TASK, string][];
export const STATI_OPZIONI = Object.entries(STATI_TASK) as [StatoTask, string][];
