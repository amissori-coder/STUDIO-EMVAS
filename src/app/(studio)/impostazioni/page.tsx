import type { Metadata } from "next";
import { Bell, ExternalLink, KeyRound, Mail, Server, Smartphone, UserRound } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guards";
import { isGoogleConfigured } from "@/lib/auth/google";
import { isMailerConfigured } from "@/lib/mailer";
import { isPushConfigured } from "@/lib/notifications";
import { formatDateTime, formatRelative } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { ProfileForm } from "@/modules/impostazioni/ProfileForm";
import { PasswordForm } from "@/modules/impostazioni/PasswordForm";
import { NotificationPrefsForm } from "@/modules/impostazioni/NotificationPrefsForm";
import { GmailCard, type GmailStatus } from "@/modules/impostazioni/GmailCard";
import { SystemCard } from "@/modules/impostazioni/SystemCard";
import pkg from "../../../../package.json";

export const metadata: Metadata = { title: "Impostazioni" };

function str(v: string | string[] | undefined) {
  return typeof v === "string" ? v : "";
}

function SectionTitle({ icon: Icon, children }: { icon: typeof UserRound; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="h-4 w-4 text-slate-400" /> {children}
    </span>
  );
}

export default async function ImpostazioniPage(props: PageProps<"/impostazioni">) {
  const user = await requireStaff();
  const sp = await props.searchParams;
  const messaggio = str(sp.messaggio);
  const errore = str(sp.errore);
  const isAdmin = user.ruolo === "ADMIN";
  const googleConfigured = isGoogleConfigured();

  const db = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      passwordHash: true,
      googleAccount: { select: { googleEmail: true, lastSyncAt: true, syncError: true, historyId: true, refreshToken: true, _count: { select: { emails: true } } } },
    },
  });
  const gmail: GmailStatus | null = db?.googleAccount
    ? {
        googleEmail: db.googleAccount.googleEmail,
        lastSyncLabel: db.googleAccount.lastSyncAt ? formatRelative(db.googleAccount.lastSyncAt) : "Mai eseguita",
        lastSyncTitle: db.googleAccount.lastSyncAt ? formatDateTime(db.googleAccount.lastSyncAt) : null,
        syncError: db.googleAccount.syncError,
        hasHistory: !!db.googleAccount.historyId,
        hasRefreshToken: !!db.googleAccount.refreshToken,
        emailCount: db.googleAccount._count.emails,
      }
    : null;

  return (
    <>
      <PageHeader title="Impostazioni" description="Il tuo profilo, la sicurezza dell'account, le notifiche e le integrazioni." />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title={<SectionTitle icon={UserRound}>Profilo</SectionTitle>} description="Come ti vedono i colleghi." />
          <CardBody>
            <ProfileForm nome={user.nome} email={user.email} telefono={user.telefono} colore={user.colore} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={<SectionTitle icon={KeyRound}>Password</SectionTitle>} description="Cambia la password di accesso alla piattaforma." />
          <CardBody>
            <PasswordForm hasPassword={!!db?.passwordHash} email={user.email} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={<SectionTitle icon={Bell}>Notifiche</SectionTitle>} description="Scegli come ricevere gli avvisi su scadenze, chat, email e assenze." />
          <CardBody>
            <NotificationPrefsForm notificaEmail={user.notificaEmail} notificaPush={user.notificaPush} pushConfigured={isPushConfigured()} mailerConfigured={isMailerConfigured()} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={<SectionTitle icon={Mail}>Gmail</SectionTitle>} description="Importa le email dei clienti dalla tua casella Google." />
          <CardBody>
            {googleConfigured ? (
              <GmailCard status={gmail} messaggio={messaggio} errore={errore} />
            ) : (
              <div className="space-y-3">
                <Alert kind="info" title="Integrazione Google non configurata">
                  Per collegare Gmail l&apos;amministratore deve impostare <code className="rounded bg-white/70 px-1 font-mono text-xs">GOOGLE_CLIENT_ID</code> e{" "}
                  <code className="rounded bg-white/70 px-1 font-mono text-xs">GOOGLE_CLIENT_SECRET</code> nel file <code className="rounded bg-white/70 px-1 font-mono text-xs">.env</code> del server e riavviare
                  l&apos;applicazione.
                </Alert>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
                  <li>Su Google Cloud Console crea un progetto e abilita la Gmail API.</li>
                  <li>Configura la schermata di consenso OAuth.</li>
                  <li>
                    Crea credenziali OAuth 2.0 «Applicazione web» con URI di reindirizzamento <span className="font-mono text-xs">{"{APP_URL}"}/api/auth/google/callback</span>.
                  </li>
                  <li>Inserisci le credenziali nel .env e riavvia.</li>
                </ol>
                <p className="flex items-start gap-1.5 text-sm text-slate-600">
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span>
                    Istruzioni complete nel file <span className="font-mono text-xs">README.md</span> del progetto, sezione «Google / Gmail».
                  </span>
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={<SectionTitle icon={Smartphone}>Installa l&apos;app sul telefono</SectionTitle>} description="Studio EMVAS funziona come app: icona sulla schermata Home, apertura a schermo intero e notifiche push." />
          <CardBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-900">Android (Chrome)</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-600">
                  <li>Apri questo sito in Chrome.</li>
                  <li>Tocca il menu ⋮ in alto a destra.</li>
                  <li>Scegli «Installa app» (o «Aggiungi a schermata Home»).</li>
                </ol>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-900">iPhone / iPad (Safari)</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-600">
                  <li>Apri questo sito in Safari.</li>
                  <li>Tocca il pulsante Condividi (quadrato con la freccia).</li>
                  <li>Scegli «Aggiungi alla schermata Home» e conferma.</li>
                </ol>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Dopo l&apos;installazione apri l&apos;app dall&apos;icona e attiva le notifiche dalla sezione Notifiche qui sopra.</p>
          </CardBody>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader title={<SectionTitle icon={Server}>Stato sistema</SectionTitle>} description="Configurazione del server e strumenti di amministrazione." />
            <CardBody>
              <SystemCard
                status={{
                  googleConfigured,
                  pushConfigured: isPushConfigured(),
                  mailerConfigured: isMailerConfigured(),
                  cronEnabled: process.env.ENABLE_CRON !== "false" && process.env.ENABLE_CRON !== "0",
                  appUrl: process.env.APP_URL ?? "http://localhost:3000",
                  version: pkg.version,
                  nodeEnv: process.env.NODE_ENV ?? "development",
                }}
              />
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
