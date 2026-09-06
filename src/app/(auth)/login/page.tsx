import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isGoogleConfigured } from "@/lib/auth/google";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Accedi" };

export default async function LoginPage(props: PageProps<"/login">) {
  const session = await getSession();
  if (session) redirect(session.ruolo === "CLIENTE" ? "/portale" : "/dashboard");
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  const errore = typeof sp.errore === "string" ? sp.errore : "";
  const messaggio = typeof sp.messaggio === "string" ? sp.messaggio : "";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-10">
      <div className="mb-6 flex flex-col items-center gap-2">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-xl font-bold text-white">E</span>
        <h1 className="text-xl font-semibold text-slate-900">Studio EMVAS</h1>
        <p className="text-sm text-slate-500">Area riservata studio e clienti</p>
      </div>
      <LoginForm next={next} googleEnabled={isGoogleConfigured()} errore={errore} messaggio={messaggio} />
      <p className="mt-6 text-center text-xs text-slate-400">
        Accesso riservato. Se sei un cliente e non hai le credenziali, contatta lo studio.
      </p>
    </div>
  );
}
