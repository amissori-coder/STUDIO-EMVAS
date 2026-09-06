import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound, LogIn } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { RUOLI } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { InviteForm } from "@/modules/team/InviteForm";

export const metadata: Metadata = { title: "Invito" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-10">
      <div className="mb-6 flex flex-col items-center gap-2">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-xl font-bold text-white">E</span>
        <h1 className="text-xl font-semibold text-slate-900">Studio EMVAS</h1>
        <p className="text-sm text-slate-500">Attivazione account</p>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
    </div>
  );
}

export default async function InvitoPage(props: PageProps<"/invito/[token]">) {
  const { token } = await props.params;
  const valido = /^[0-9a-f]{64}$/.test(token);
  const user = valido ? await prisma.user.findUnique({ where: { inviteToken: token }, select: { id: true, nome: true, email: true, ruolo: true, colore: true, attivo: true, inviteExpires: true } }) : null;
  const scaduto = !!user && (!user.inviteExpires || user.inviteExpires < new Date());

  if (!user || !user.attivo || scaduto) {
    return (
      <Shell>
        <div className="text-center">
          <KeyRound className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <h2 className="text-base font-semibold text-slate-900">{scaduto ? "Invito scaduto" : "Invito non valido"}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {scaduto
              ? "Questo link di invito non è più valido: chiedi allo studio di inviartene uno nuovo."
              : "Il link che hai aperto non corrisponde a nessun invito attivo. Potrebbe essere già stato utilizzato."}
          </p>
          <Link href="/login" className={buttonClasses({ variant: "outline", className: "mt-5 w-full" })}>
            <LogIn className="h-4 w-4" /> Vai alla pagina di accesso
          </Link>
        </div>
      </Shell>
    );
  }

  // Se chi apre il link è già autenticato con lo stesso account, non serve rifare l'attivazione
  const session = await getSession();
  if (session && session.sub === user.id) redirect(user.ruolo === "CLIENTE" ? "/portale" : "/dashboard");

  return (
    <Shell>
      <div className="mb-5 flex items-center gap-3">
        <Avatar nome={user.nome} colore={user.colore} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">Ciao {user.nome}</p>
          <p className="truncate text-sm text-slate-500">{user.email}</p>
          <p className="text-xs text-slate-400">{RUOLI[user.ruolo as keyof typeof RUOLI] ?? user.ruolo}</p>
        </div>
      </div>
      <p className="mb-4 text-sm text-slate-600">Scegli la password con cui accederai alla piattaforma dello studio.</p>
      <InviteForm token={token} email={user.email} />
      <p className="mt-4 text-center text-xs text-slate-400">Invito valido fino al {formatDateTime(user.inviteExpires)}.</p>
    </Shell>
  );
}
