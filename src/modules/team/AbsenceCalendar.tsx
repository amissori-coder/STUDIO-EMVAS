import { cn, initials } from "@/lib/utils";
import { TIPI_ASSENZA } from "@/lib/constants";
import type { AbsenceItem } from "./queries";

const GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Calendario mensile: per ogni giorno mostra chi è assente (iniziali con il colore dell'utente). */
export function AbsenceCalendar({ anno, mese, assenze }: { anno: number; mese: number; assenze: AbsenceItem[] }) {
  const primo = new Date(anno, mese - 1, 1);
  const giorniNelMese = new Date(anno, mese, 0).getDate();
  // lunedì = 0
  const offset = (primo.getDay() + 6) % 7;
  const oggi = new Date();
  const celle: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) celle.push(null);
  for (let d = 1; d <= giorniNelMese; d++) celle.push(new Date(anno, mese - 1, d));
  while (celle.length % 7 !== 0) celle.push(null);

  function assentiIl(giorno: Date) {
    const inizio = new Date(giorno.getFullYear(), giorno.getMonth(), giorno.getDate(), 0, 0, 0, 0);
    const fine = new Date(giorno.getFullYear(), giorno.getMonth(), giorno.getDate(), 23, 59, 59, 999);
    return assenze.filter((a) => a.stato !== "RIFIUTATA" && a.dataInizio <= fine && a.dataFine >= inizio);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
        {GIORNI.map((g) => (
          <div key={g} className="py-2">
            {g}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {celle.map((giorno, i) => {
          if (!giorno) return <div key={`v-${i}`} className="min-h-16 border-b border-r border-slate-100 bg-slate-50/60 sm:min-h-24" />;
          const assenti = assentiIl(giorno);
          const weekend = giorno.getDay() === 0 || giorno.getDay() === 6;
          const isOggi = sameDay(giorno, oggi);
          return (
            <div key={giorno.toISOString()} className={cn("min-h-16 border-b border-r border-slate-100 p-1 sm:min-h-24 sm:p-1.5", weekend && "bg-slate-50/60")}>
              <p className={cn("mb-1 text-xs font-medium", isOggi ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white" : "text-slate-600")}>{giorno.getDate()}</p>
              <ul className="space-y-0.5">
                {assenti.slice(0, 4).map((a) => (
                  <li
                    key={a.id}
                    title={`${a.user.nome} · ${TIPI_ASSENZA[a.tipo as keyof typeof TIPI_ASSENZA] ?? a.tipo}${a.stato === "RICHIESTA" ? " (in attesa)" : ""}`}
                    className={cn(
                      "flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-medium leading-4 text-white sm:text-[11px]",
                      a.stato === "RICHIESTA" && "opacity-60 ring-1 ring-inset ring-white/70 [background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(255,255,255,.35)_3px,rgba(255,255,255,.35)_6px)]",
                    )}
                    style={{ backgroundColor: a.user.colore }}
                  >
                    <span className="sm:hidden">{initials(a.user.nome)}</span>
                    <span className="hidden truncate sm:inline">{a.user.nome.split(" ")[0]}</span>
                  </li>
                ))}
                {assenti.length > 4 && <li className="text-[10px] text-slate-500">+{assenti.length - 4}</li>}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">Le assenze in attesa di approvazione sono mostrate tratteggiate. Le rifiutate non compaiono.</p>
    </div>
  );
}
