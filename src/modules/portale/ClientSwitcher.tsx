"use client";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Building2 } from "lucide-react";
import { selectPortalClientAction, syncPortalClientAction } from "./actions";

/**
 * Selettore del cliente per gli utenti collegati a più aziende: al cambio invia il form (server action + cookie).
 * Il cliente mostrato è quello effettivamente visualizzato dalla pagina (cartella aperta o `?cliente=`), non
 * quello del cookie: se differiscono, il cookie viene allineato in background (il layout non riceve
 * params/searchParams, quindi la deduzione avviene qui dal percorso).
 */
export function ClientSwitcher({
  clients,
  cookieId,
  folderClients,
}: {
  clients: { id: string; denominazione: string }[];
  /** cliente risolto dal cookie (o il primo disponibile) */
  cookieId: string;
  /** id cartella visibile → id cliente, per riconoscere il cliente dal percorso /portale/cartelle/[id] */
  folderClients: Record<string, string>;
}) {
  const form = useRef<HTMLFormElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const folderId = /^\/portale\/cartelle\/([^/]+)/.exec(pathname)?.[1];
  const fromFolder = folderId ? folderClients[decodeURIComponent(folderId)] : undefined;
  const fromQuery = pathname === "/portale" ? searchParams.get("cliente") : null;
  const known = (id: string | null | undefined) => (id && clients.some((c) => c.id === id) ? id : null);
  const currentId = known(fromFolder) ?? known(fromQuery) ?? cookieId;

  useEffect(() => {
    if (currentId !== cookieId) void syncPortalClientAction(currentId);
  }, [currentId, cookieId]);

  return (
    <form ref={form} action={selectPortalClientAction} className="flex items-center gap-1.5">
      <Building2 className="hidden h-4 w-4 text-slate-400 sm:block" aria-hidden="true" />
      <select
        name="clientId"
        value={currentId}
        onChange={() => form.current?.requestSubmit()}
        aria-label="Azienda"
        className="h-10 max-w-[11rem] rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 sm:max-w-[16rem]"
      >
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.denominazione}
          </option>
        ))}
      </select>
    </form>
  );
}
