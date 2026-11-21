import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { leggiSecondoPasso } from "@/lib/auth/secondo-passo";
import { CodiceForm } from "./CodiceForm";

export const metadata: Metadata = { title: "Codice di verifica" };

export default async function CodicePage() {
  const utente = await getCurrentUser();
  if (utente) redirect(utente.ruolo === "CLIENTE" ? "/portale" : "/dashboard");
  const passo = await leggiSecondoPasso();
  if (!passo) redirect("/login?errore=codice-scaduto");
  const user = await prisma.user.findUnique({ where: { id: passo.sub }, select: { nome: true, attivo: true } });
  if (!user?.attivo) redirect("/login?errore=codice-scaduto");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-10">
      <div className="mb-6 flex flex-col items-center gap-2">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-xl font-bold text-white">E</span>
        <h1 className="text-xl font-semibold text-slate-900">Studio EMVAS</h1>
      </div>
      <CodiceForm nome={user.nome.split(" ")[0] ?? user.nome} />
    </div>
  );
}
