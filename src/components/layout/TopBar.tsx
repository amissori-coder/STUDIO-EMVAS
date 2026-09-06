import Link from "next/link";
import type { CurrentUser } from "@/lib/auth/guards";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { Avatar } from "@/components/ui/Avatar";

export function TopBar({ user }: { user: CurrentUser }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 lg:h-16 lg:px-8">
      <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-sm font-bold text-white">E</span>
        <span className="text-sm font-semibold text-slate-900">Studio EMVAS</span>
      </Link>
      <div className="hidden lg:block" />
      <div className="flex items-center gap-2">
        <NotificationBell />
        <Link href="/impostazioni" className="rounded-full" title="Impostazioni">
          <Avatar nome={user.nome} colore={user.colore} size="sm" />
        </Link>
      </div>
    </header>
  );
}
