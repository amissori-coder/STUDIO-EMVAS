import Link from "next/link";
import { Paperclip, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn, formatDateTime, formatRelative, truncate } from "@/lib/utils";
import type { EmailListItem } from "./queries";

export function EmailSender({ email, className }: { email: Pick<EmailListItem, "fromAddr" | "fromName">; className?: string }) {
  return (
    <span className={cn("min-w-0", className)}>
      {email.fromName ? (
        <>
          <span className="font-medium text-slate-900">{email.fromName}</span>{" "}
          <span className="text-slate-500">&lt;{email.fromAddr}&gt;</span>
        </>
      ) : (
        <span className="font-medium text-slate-900">{email.fromAddr}</span>
      )}
    </span>
  );
}

/** Riga (card) dell'elenco email: si usa sia nella casella unificata che nella scheda cliente. */
export function EmailRow({ email, showClient = true, showAccount = false }: { email: EmailListItem; showClient?: boolean; showAccount?: boolean }) {
  return (
    <li>
      <Link
        href={`/email/${email.id}`}
        className={cn(
          "flex gap-3 px-4 py-3 transition-colors hover:bg-slate-50 sm:px-5",
          email.isUnread ? "bg-blue-50/40" : "bg-white",
        )}
      >
        <span className="mt-2 flex w-2 shrink-0 justify-center" aria-hidden="true">
          <span className={cn("h-2 w-2 rounded-full", email.isUnread ? "bg-blue-600" : "bg-transparent")} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <EmailSender email={email} className={cn("truncate text-sm", email.isUnread && "font-semibold")} />
            <span className="shrink-0 text-xs text-slate-500" title={formatDateTime(email.receivedAt)}>
              {formatRelative(email.receivedAt)}
            </span>
          </div>
          <p className={cn("mt-0.5 truncate text-sm text-slate-900", email.isUnread ? "font-semibold" : "font-medium")}>
            {email.hasAttachments && <Paperclip className="mr-1 inline h-3.5 w-3.5 text-slate-400" aria-label="Con allegati" />}
            {email.subject || "(senza oggetto)"}
          </p>
          {email.snippet && <p className="mt-0.5 truncate text-sm text-slate-500">{truncate(email.snippet, 140)}</p>}
          {(showClient || email.task || showAccount || email.archiviata) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {showClient && email.client && (
                <Badge color="blue">
                  {email.client.denominazione}
                  {email.linkAuto && <span className="font-normal text-blue-500">· auto</span>}
                </Badge>
              )}
              {email.task && (
                <Badge color="purple">
                  <ListChecks className="h-3 w-3" />
                  {truncate(email.task.titolo, 40)}
                </Badge>
              )}
              {email.archiviata && <Badge color="slate">Archiviata</Badge>}
              {showAccount && <span className="text-xs text-slate-400">{email.account.googleEmail}</span>}
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}
