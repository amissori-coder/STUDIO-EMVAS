# Studio EMVAS – Architettura e convenzioni

Piattaforma gestionale per studio commercialista: area riservata staff (clienti, adempimenti,
attività, email Gmail, chat interna, team/assenze, notifiche) e portale clienti (upload documenti).

## Stack
- **Next.js 16** (App Router, Turbopack, React 19, Server Components + Server Actions), TypeScript strict.
- **Tailwind CSS v4** (`@import "tailwindcss"` in `src/app/globals.css`), icone `lucide-react`.
- **Prisma 6 + SQLite** (`prisma/schema.prisma`, file DB in `data/emvas.db`). Nessun enum nativo:
  i valori ammessi e le etichette italiane sono in `src/lib/constants.ts`.
- Autenticazione propria: cookie JWT (`jose`) + password `bcryptjs`; OAuth Google per login staff e Gmail.
- `swr` per polling client (chat, notifiche), `zod` v4 per validazione, `date-fns` v4 (locale `it`).
- Notifiche: in-app (tabella `Notification`) + Web Push (`web-push`, VAPID) + email SMTP opzionale.
- Cron interno con `node-cron` avviato da `src/instrumentation.ts` (`src/lib/cron/scheduler.ts`).

## Regole Next.js 16 (IMPORTANTI)
- `params` e `searchParams` sono **Promise**: `const { id } = await props.params`. Usa i tipi globali
  `PageProps<"/clienti/[id]">`, `LayoutProps<"/...">`, `RouteContext<"/api/...">` (generati da `next typegen`;
  in alternativa tipizza a mano `{ params: Promise<{ id: string }> }`).
- `cookies()` / `headers()` sono async.
- Il file `src/proxy.ts` (ex middleware) protegge le rotte: staff → tutto tranne `/portale`; CLIENTE → solo
  `/portale`, `/api/portale`, `/api/documenti`, `/api/notifiche`, `/api/push`.
- Server Actions: file con `"use server"` in cima; in ogni action chiama **sempre** un guard
  (`requireStaffAction`, `requireAdminAction`, `requireClientAccessAction(clientId)`) prima di toccare il DB.
- Per invalidare i dati dopo una mutazione usa `revalidatePath("/percorso")` da `next/cache` (le pagine sono dinamiche).
- Non usare `next lint`: il comando è `npm run lint` (eslint). Typecheck: `npm run typecheck`.

## Struttura cartelle
```
prisma/schema.prisma, prisma/seed.ts        schema + seed (admin, catalogo adempimenti, dati demo con SEED_DEMO=1)
src/proxy.ts                                 protezione rotte
src/instrumentation.ts                       avvio cron
src/lib/
  db.ts                prisma client singleton
  constants.ts         enum/etichette (RUOLI, TIPI_SOGGETTO, REGIMI_FISCALI, STATI_TASK, TIPI_NOTIFICA, CARTELLE_DEFAULT…)
  utils.ts             cn, formatDate, formatDateTime, formatRelative, describeDeadline, daysUntil, formatBytes,
                       initials, safeJsonParse, toDateInputValue, parseDateInput, startOfDayLocal, addDays, normalizeEmail, truncate
  auth/session.ts      getSession, createSession, destroySession (cookie)
  auth/guards.ts       getCurrentUser (memoizzato), requireStaff/requireAdmin/requireClientUser (pagine: redirect),
                       requireStaffAction/requireAdminAction/requireUserAction/requireClientAccessAction (actions: throw AuthError),
                       isStaff, isAdmin, canAccessClient, tipo CurrentUser {id,email,nome,ruolo,colore,hasGoogle,clientIds,…}
  auth/password.ts     hashPassword, verifyPassword, validatePasswordStrength
  auth/jwt.ts          signSession/verifySessionToken (claim `sv` = User.sessionVersion: incrementalo al reset password per
                       invalidare le sessioni esistenti; getCurrentUser rifiuta i token con versione diversa)
  auth/redirect.ts     isSafeInternalPath/safeInternalPath: validazione del parametro `next` (niente //host, backslash, schemi)
  auth/rate-limit.ts   checkRateLimit/recordAttempt/resetRateLimit (login: 10 tentativi per email, 50 per IP ogni 15 minuti)
  html-sanitize.ts     sanitizeHtml a tokenizer (allowlist tag/attributi/schemi) usato per l'HTML delle email
  auth/google.ts       OAuth Google (buildGoogleAuthUrl, exchangeCodeForTokens, refreshAccessToken, isGoogleConfigured)
  gmail-parse.ts       parsing puro dei messaggi Gmail (parseAddress, parseGmailMessage, sanitizeEmailHtml) - testabile
  gmail.ts             (ri-esporta gmail-parse) syncGoogleAccount(accountId), syncAllGoogleAccounts(), fetchGmailAttachment(accountId, gmailId, attachmentId),
                       findClientByEmails(addresses), sanitizeEmailHtml(html), gmailWebUrl(googleEmail, gmailId), parseAddress
  notifications.ts     notify({userId,tipo,titolo,corpo?,link?,push?,email?}), notifyMany(ids, …), notifyAdmins(…, excludeUserId?),
                       sendPushToUser, countUnreadNotifications, isPushConfigured, appUrl
  mailer.ts            sendEmail({to,subject,text,html?}), isMailerConfigured
  storage.ts           saveUpload({clientId, originalName, data}) -> storagePath; readUpload, streamUpload, deleteUpload,
                       resolveUploadPath, isAllowedFilename, getMaxUploadBytes
  audit.ts             audit({userId, azione, entita, entitaId, dettagli})
  adempimenti/catalogo.ts   catalogo predefinito (usato dal seed)
  adempimenti/calendario.ts festività italiane, primoGiornoLavorativo, prorogaAgosto (1-20 agosto -> 20), scadenzaEffettiva, MESI
  adempimenti/regole.ts     regole pure: isApplicabile, deveGenerare, calcolaScadenze(template, anno), chiaveTask, sostituisciAnno
                            (segnaposto {anno} {annoPrec} {annoPrec2}); idx stabile: mese per le mensili, mese*100+giorno per le voci fisse
  adempimenti/engine.ts     (ri-esporta regole) anteprimaPianificazione(clientId, anno),
                            pianificaAnno({clientId, anno, createdById, templateIds?, assigneeId?, saltaPassate?})
  cron/jobs.ts         jobPromemoriaScadenze, jobAllertaAssenze (deduplicata: stessa allerta non ripetuta), jobSincronizzaGmail, eseguiJobGiornalieri
  cron/auth.ts         authorizeCron(request, job): Bearer CRON_SECRET (solo header) oppure sessione admin solo su POST
src/components/ui/     kit UI: Button (variant primary|secondary|outline|ghost|danger, size sm|md|lg|icon, prop href → Link),
                       SubmitButton (pending), Input/Textarea/Select/Label/Field/Checkbox, Card/CardHeader/CardBody,
                       Badge (+ STATO_TASK_COLOR, PRIORITA_COLOR, STATO_ASSENZA_COLOR, TIPO_ASSENZA_COLOR, REGIME_COLOR),
                       PageHeader, EmptyState, Alert, Avatar, Modal (client), Tabs (client, link-based), ConfirmButton, Spinner
src/components/layout/ AppShell, Sidebar, MobileNav, TopBar, NotificationBell, nav.ts (NAV_ITEMS)
src/components/push/PushManager.tsx   bottone attiva/disattiva push (da usare in Impostazioni)
src/modules/<modulo>/  componenti e actions riutilizzabili di ciascun modulo:
  clienti/       ClientForm, AnagraficaTab, ContactsCard, PortalAccessCard, actions (crea/modifica/archivia/elimina, contatti,
                 utenti portale: solo admin o referente, vedi permessi.ts), queries (getClientOrNotFound, listClients), validation
  attivita/      TaskForm, TaskRow, TaskFilters, TaskEditModal, ClientTasksTab (+ PianificazioneCard), CalendarioFiltri,
                 actions (crea/aggiorna/stato/riassegna/elimina con notifiche), queries (elenco paginato), pianificazione
  adempimenti/   TemplateForm (editor scadenze), PianificazioneMassivaForm, ClientePicker, descrivi (scadenze in forma leggibile), actions
  email/         EmailRow, EmailFilters, EmailBody (iframe sandbox), AssociationForm, AttachmentSaveForm, SyncButton, ClientEmailsTab,
                 actions (associa/scollega/archivia/salva allegato/sync), queries
  chat/          ChatLayout, ConversationList, ChatConversation (polling SWR), ClientChatPanel, service (non letti, menzioni), actions, text
  team/          StaffList, TeamTabs, InviteForm, assenze (AbsenceCard/Calendar/Filters/RequestButton/Actions), dashboard.ts (loadDashboard),
                 queries, actions (collaboratori, inviti, password temporanee, assenze con notifiche)
  notifiche/     NotificationIcon, actions (segna letta/tutte, pulizia)
  impostazioni/  ProfileForm, PasswordForm, NotificationPrefsForm, GmailCard, SystemCard, actions
  documenti/     ClientDocumentsTab (lato studio), DocumentsManager, UploadDropzone, FolderFormModal, DocumentRow, service (albero cartelle), actions
  portale/       service (cliente corrente, cartelle visibili) e componenti del portale clienti
src/app/(auth)/login   login (password + Google)
src/app/(studio)/...   area staff (layout con AppShell, richiede staff)
src/app/(portale)/portale/...  portale clienti (richiede ruolo CLIENTE)
src/app/api/...        route handler:
  auth/google, auth/google/callback, auth/logout [solo POST]     accesso Google e uscita
  cron/daily, cron/gmail                                        job (Bearer CRON_SECRET o admin via POST)
  push/subscribe, push/config                                   sottoscrizioni push e chiave VAPID
  notifiche, notifiche/unread, notifiche/[id]/apri              elenco/contatore/apertura notifiche (solo proprie)
  chat/[clientId]/messages                                      polling e invio messaggi (staff)
  email/tasks                                                   attività aperte di un cliente per il form di associazione (staff)
  documenti/upload, documenti/[id]                              caricamento (multipart) e download/eliminazione con controllo accessi
  health                                                        stato del server
```

## Contratti tra moduli
La scheda cliente `src/app/(studio)/clienti/[id]/page.tsx` mostra tab (`?tab=`) e importa componenti
server async con firma `({ clientId, user }: { clientId: string; user: CurrentUser })`:
- `@/modules/attivita/ClientTasksTab` (export `ClientTasksTab`)
- `@/modules/email/ClientEmailsTab` (export `ClientEmailsTab`)
- `@/modules/chat/ClientChatPanel` (export `ClientChatPanel`)
- `@/modules/documenti/ClientDocumentsTab` (export `ClientDocumentsTab`)

Link canonici: `/clienti/[id]`, `/clienti/[id]?tab=attivita|email|chat|documenti`, `/attivita/[id]`, `/attivita/nuova?cliente=&titolo=`,
`/email/[id]`, `/chat/[clientId]`, `/team`, `/team/assenze`, `/adempimenti`, `/adempimenti/[id]`, `/notifiche`, `/impostazioni`,
`/invito/[token]` (pubblico), `/portale`, `/portale/cartelle/[id]`.
Le notifiche create dai job usano questi link (`/attivita/[id]`, `/email/[id]`, `/attivita?assegnatario=…&stato=aperte`).

## Convenzioni
- Lingua UI: **italiano**. Date in formato `dd/MM/yyyy` tramite `formatDate`.
- Mobile-first: layout responsive (tabelle → card su schermi piccoli o `overflow-x-auto`), target touch ≥ 40px.
- Server Component di default; `"use client"` solo dove serve interattività.
- Le date "solo giorno" (scadenze, assenze) si salvano a mezzogiorno locale (`parseDateInput`) per evitare slittamenti di fuso.
- Ogni mutazione rilevante registra un `audit(...)`.
- Notifiche: alla creazione/assegnazione di un'attività notifica l'assegnatario (`ATTIVITA_ASSEGNATA`);
  nuovo messaggio chat → referente cliente + utenti menzionati (`@Nome`); documento caricato dal cliente → referente;
  richiesta assenza → admin; esito assenza → richiedente.
- Non modificare `prisma/schema.prisma` senza coordinamento: se serve un campo, segnalalo.
- Cartelle documenti: alla creazione di un cliente si creano le `CARTELLE_DEFAULT`.

## Comandi
```
npm run setup          # prisma generate + db push + seed
npm run db:seed:demo   # dati dimostrativi
npm run dev            # http://localhost:3000
npm run typecheck && npm run lint && npm run build
npm run test:unit      # test unitari (node:test via tsx) in tests/unit
BASE_URL=http://localhost:3000 npm run test:e2e   # smoke test Playwright (server avviato, dati demo)
```

## Regole ESLint da rispettare (eslint-config-next 16 + React Compiler rules)
- `react-hooks/set-state-in-effect`: **non chiamare setState in modo sincrono dentro `useEffect`**. Calcola lo stato
  iniziale nello `useState`, oppure fai il setState dentro un callback/async (dopo un `await`) o in un handler.
- Niente `any`; tipizza i dati Prisma con `Prisma.XGetPayload<…>` o tipi inferiti.
- Usa `<Link>` di `next/link` per la navigazione interna, non `<a>`.
