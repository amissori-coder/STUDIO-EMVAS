import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";

export default function StudioNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <SearchX className="mb-3 h-12 w-12 text-slate-400" aria-hidden="true" />
      <h1 className="text-xl font-semibold text-slate-900">Pagina non trovata</h1>
      <p className="mt-1 max-w-md text-sm text-slate-500">L&apos;elemento richiesto non esiste o è stato eliminato.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link href="/dashboard" className={buttonClasses()}>
          Dashboard
        </Link>
        <Link href="/clienti" className={buttonClasses({ variant: "outline" })}>
          Clienti
        </Link>
        <Link href="/attivita" className={buttonClasses({ variant: "outline" })}>
          Attività
        </Link>
      </div>
    </div>
  );
}
