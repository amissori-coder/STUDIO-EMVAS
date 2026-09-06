import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireClientUser } from "@/lib/auth/guards";
import { Avatar } from "@/components/ui/Avatar";

export default async function PortaleLayout({ children }: { children: ReactNode }) {
  const user = await requireClientUser();
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/portale" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-sm font-bold text-white">E</span>
            <span className="text-sm font-semibold text-slate-900">Studio EMVAS · Area clienti</span>
          </Link>
          <div className="flex items-center gap-2">
            <Avatar nome={user.nome} colore={user.colore} size="sm" />
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="rounded-md p-2 text-slate-500 hover:bg-slate-100" title="Esci" aria-label="Esci">
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 pb-safe">{children}</main>
    </div>
  );
}
