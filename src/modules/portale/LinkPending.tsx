"use client";
import { useLinkStatus } from "next/link";
import type { ReactNode } from "react";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Da usare dentro un `<Link>`: mostra uno spinner al posto di `children` mentre la navigazione è in corso,
 * così un tocco sul telefono ha un riscontro immediato anche se la pagina di destinazione è dinamica.
 * (Non si usa `loading.tsx`: renderebbe la risposta in streaming e `notFound()`/`redirect()` delle pagine
 * non produrrebbero più i codici HTTP 404/307.)
 */
export function LinkPending({ children, className }: { children: ReactNode; className?: string }) {
  const { pending } = useLinkStatus();
  return pending ? <Spinner className={className} /> : <>{children}</>;
}
