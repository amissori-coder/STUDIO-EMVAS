"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, MessageSquare, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export interface ConversationDto {
  id: string;
  denominazione: string;
  attivo: boolean;
  preview: string | null;
  /** già formattato lato server */
  timeLabel: string | null;
  unread: number;
}

/** Elenco delle conversazioni (una per cliente) con ricerca locale e sezione a scomparsa per i clienti senza messaggi. */
export function ConversationList({ items, activeId }: { items: ConversationDto[]; activeId?: string }) {
  const [q, setQ] = useState("");
  const [showEmpty, setShowEmpty] = useState(false);
  const f = q.trim().toLowerCase();
  const filtered = f ? items.filter((i) => i.denominazione.toLowerCase().includes(f)) : items;
  const withMessages = filtered.filter((i) => i.preview !== null);
  const withoutMessages = filtered.filter((i) => i.preview === null);
  const expandEmpty = showEmpty || !!f || withMessages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="relative p-3">
        <Search className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca cliente…" aria-label="Cerca cliente" className="pl-9" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">Nessun cliente corrisponde alla ricerca.</p>}
        <ul className="divide-y divide-slate-100">
          {withMessages.map((c) => (
            <ConversationRow key={c.id} item={c} active={c.id === activeId} />
          ))}
        </ul>
        {withoutMessages.length > 0 && (
          <div className="border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowEmpty((v) => !v)}
              className="flex min-h-10 w-full items-center justify-between px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 hover:bg-slate-50"
              aria-expanded={expandEmpty}
            >
              Senza messaggi ({withoutMessages.length})
              <ChevronDown className={cn("h-4 w-4 transition-transform", expandEmpty && "rotate-180")} />
            </button>
            {expandEmpty && (
              <ul className="divide-y divide-slate-100">
                {withoutMessages.map((c) => (
                  <ConversationRow key={c.id} item={c} active={c.id === activeId} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationRow({ item, active }: { item: ConversationDto; active: boolean }) {
  return (
    <li>
      <Link
        href={`/chat/${item.id}`}
        className={cn("flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50", active && "bg-blue-50 hover:bg-blue-50")}
        aria-current={active ? "page" : undefined}
      >
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", active ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500")}>
          <MessageSquare className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-sm", item.unread > 0 ? "font-semibold text-slate-900" : "font-medium text-slate-800")}>
              {item.denominazione}
              {!item.attivo && <span className="ml-1 text-xs font-normal text-slate-400">(archiviato)</span>}
            </span>
            {item.timeLabel && <span className="shrink-0 text-[11px] text-slate-400">{item.timeLabel}</span>}
          </span>
          <span className="mt-0.5 flex items-center justify-between gap-2">
            <span className={cn("truncate text-xs", item.unread > 0 ? "text-slate-700" : "text-slate-500")}>
              {item.preview ?? "Nessun messaggio"}
            </span>
            {item.unread > 0 && (
              <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-semibold text-white">
                {item.unread > 99 ? "99+" : item.unread}
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}
