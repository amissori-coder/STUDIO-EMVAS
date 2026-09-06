"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  label: ReactNode;
  href: string;
  /** chiave usata per il confronto con ?tab= (se omessa si confronta il pathname) */
  key?: string;
  badge?: ReactNode;
}

/** Barra di tab basata su link. Se `param` è indicato, la tab attiva è quella con key == searchParams[param]. */
export function Tabs({ items, param, defaultKey, className }: { items: TabItem[]; param?: string; defaultKey?: string; className?: string }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = param ? (sp.get(param) ?? defaultKey ?? items[0]?.key) : null;
  return (
    <nav className={cn("-mx-1 flex gap-0.5 overflow-x-auto border-b border-slate-200 px-1 sm:gap-1", className)} aria-label="Sezioni">
      {items.map((it) => {
        const active = param ? it.key === current : pathname === it.href || pathname.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "-mb-px inline-flex min-h-10 shrink-0 items-center gap-1.5 border-b-2 px-2 py-2 text-[13px] font-medium transition-colors sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm",
              active ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
            )}
          >
            {it.label}
            {it.badge}
          </Link>
        );
      })}
    </nav>
  );
}
