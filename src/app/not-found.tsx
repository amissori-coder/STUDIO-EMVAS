import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 text-center">
      <SearchX className="mb-3 h-12 w-12 text-slate-400" aria-hidden="true" />
      <h1 className="text-xl font-semibold text-slate-900">Pagina non trovata</h1>
      <p className="mt-1 max-w-md text-sm text-slate-500">L&apos;indirizzo non esiste o l&apos;elemento è stato eliminato.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link href="/" className={buttonClasses()}>
          Vai alla home
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
