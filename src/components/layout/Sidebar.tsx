"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/layout/nav";
import type { CurrentUser } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { LogOut } from "lucide-react";
import { RUOLI } from "@/lib/constants";

export function Sidebar({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-sm font-bold text-white">E</span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">Studio EMVAS</p>
          <p className="text-[11px] text-slate-500">Area riservata</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3" aria-label="Principale">
        {NAV_ITEMS.filter((i) => !i.adminOnly || user.ruolo === "ADMIN").map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar nome={user.nome} colore={user.colore} size="sm" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-slate-900">{user.nome}</p>
            <p className="truncate text-xs text-slate-500">{RUOLI[user.ruolo]}</p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" title="Esci" aria-label="Esci">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
