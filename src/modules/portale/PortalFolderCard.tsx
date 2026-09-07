import Link from "next/link";
import { ChevronRight, Folder, Lock } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { LinkPending } from "./LinkPending";
import { portalCountDeep, type PortalFolder } from "./service";

/** Card grande e "touch-friendly" di una cartella del portale. */
export function PortalFolderCard({ folder }: { folder: PortalFolder }) {
  const totale = portalCountDeep(folder);
  return (
    <Link
      href={`/portale/cartelle/${folder.id}`}
      className="group flex min-h-[5.5rem] items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/40 active:bg-blue-50"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 group-hover:bg-blue-100">
        <Folder className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-base font-semibold text-slate-900">{folder.nome}</span>
          {!folder.clientePuoCaricare && <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-label="Solo consultazione" />}
        </span>
        {folder.descrizione && <span className="mt-0.5 line-clamp-2 block text-sm text-slate-500">{folder.descrizione}</span>}
        <span className="mt-1 block text-xs text-slate-500">
          {totale === 0 ? "Nessun documento" : `${totale} document${totale === 1 ? "o" : "i"}`}
          {folder.ultimoCaricamento && ` · ultimo caricamento ${formatDate(folder.ultimoCaricamento)}`}
          {folder.children.length > 0 && ` · ${folder.children.length} sottocartell${folder.children.length === 1 ? "a" : "e"}`}
        </span>
      </span>
      <LinkPending className="h-5 w-5 shrink-0 text-blue-600">
        <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 group-hover:text-blue-600" />
      </LinkPending>
    </Link>
  );
}
