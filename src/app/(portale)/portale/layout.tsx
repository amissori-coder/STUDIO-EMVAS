import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut, Mail } from "lucide-react";
import { requireClientUser } from "@/lib/auth/guards";
import { Avatar } from "@/components/ui/Avatar";
import { ClientSwitcher } from "@/modules/portale/ClientSwitcher";
import { getPortalClients, getStudioContactEmail, resolvePortalClient } from "@/modules/portale/service";

export default async function PortaleLayout({ children }: { children: ReactNode }) {
  const user = await requireClientUser();
  const clients = await getPortalClients(user);
  const current = await resolvePortalClient(clients);
  const contatto = getStudioContactEmail();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/portale" className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-sm font-bold text-white">E</span>
            <span className="truncate text-sm font-semibold text-slate-900">
              Studio EMVAS <span className="hidden text-slate-500 sm:inline">· Area clienti</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {clients.length > 1 && current && <ClientSwitcher clients={clients} currentId={current.id} />}
            <span className="hidden max-w-[10rem] truncate text-sm text-slate-600 sm:inline" title={user.nome}>
              {user.nome}
            </span>
            <Avatar nome={user.nome} colore={user.colore} size="sm" />
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" title="Esci" aria-label="Esci">
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">{children}</main>
      <footer className="border-t border-slate-200 bg-white pb-safe">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Studio EMVAS · Area riservata ai clienti</p>
          <p className="flex items-center gap-1">
            Hai bisogno di aiuto? Contatta lo studio
            {contatto && (
              <a href={`mailto:${contatto}`} className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline">
                <Mail className="h-3.5 w-3.5" /> {contatto}
              </a>
            )}
          </p>
        </div>
      </footer>
    </div>
  );
}
