"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { MOBILE_PRIMARY, NAV_ITEMS } from "@/components/layout/nav";
import type { CurrentUser } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";

export function MobileNav({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || user.ruolo === "ADMIN");
  const primary = items.filter((i) => MOBILE_PRIMARY.includes(i.href));
  const secondary = items.filter((i) => !MOBILE_PRIMARY.includes(i.href));
  const secondaryActive = secondary.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 pb-safe shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Menu"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar nome={user.nome} colore={user.colore} size="sm" />
                <div className="leading-tight">
                  <p className="text-sm font-medium text-slate-900">{user.nome}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Chiudi">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {secondary.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-xs font-medium",
                      active ? "bg-blue-50 text-blue-700" : "bg-slate-50 text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-center leading-tight">{item.label}</span>
                  </Link>
                );
              })}
              <form action="/api/auth/logout" method="post" className="contents">
                <button type="submit" className="flex flex-col items-center gap-1 rounded-xl bg-slate-50 px-2 py-3 text-xs font-medium text-red-600 hover:bg-red-50">
                  <LogOut className="h-5 w-5" />
                  Esci
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-safe backdrop-blur lg:hidden"
        aria-label="Navigazione mobile"
      >
        {primary.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-blue-700" : "text-slate-500")}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", secondaryActive ? "text-blue-700" : "text-slate-500")}
        >
          <Menu className="h-5 w-5" />
          Altro
        </button>
      </nav>
    </>
  );
}
