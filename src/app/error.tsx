"use client";
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/Button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="mb-3 h-12 w-12 text-red-500" aria-hidden="true" />
      <h1 className="text-xl font-semibold text-slate-900">Si è verificato un errore</h1>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        Riprova tra qualche istante. Se il problema persiste, segnalalo all&apos;amministratore
        {error.digest ? ` indicando il codice ${error.digest}` : ""}.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button onClick={() => reset()}>Riprova</Button>
        <Link href="/" className={buttonClasses({ variant: "outline" })}>
          Torna alla home
        </Link>
      </div>
    </div>
  );
}
