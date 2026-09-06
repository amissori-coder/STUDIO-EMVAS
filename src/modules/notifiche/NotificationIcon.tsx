import {
  AlertTriangle,
  AtSign,
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  ClipboardList,
  FileUp,
  Mail,
  MessageSquare,
  Sun,
  UserRoundX,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONE: Record<string, { icon: LucideIcon; className: string }> = {
  ATTIVITA_ASSEGNATA: { icon: ClipboardList, className: "bg-blue-50 text-blue-600" },
  SCADENZA_VICINA: { icon: CalendarClock, className: "bg-yellow-50 text-yellow-700" },
  SCADENZA_OGGI: { icon: Sun, className: "bg-amber-50 text-amber-600" },
  SCADUTA: { icon: AlertTriangle, className: "bg-red-50 text-red-600" },
  ALLERTA_ASSENZA: { icon: UserRoundX, className: "bg-orange-50 text-orange-600" },
  CHAT_MENZIONE: { icon: AtSign, className: "bg-purple-50 text-purple-600" },
  CHAT_MESSAGGIO: { icon: MessageSquare, className: "bg-purple-50 text-purple-600" },
  EMAIL_CLIENTE: { icon: Mail, className: "bg-teal-50 text-teal-600" },
  DOCUMENTO_CARICATO: { icon: FileUp, className: "bg-teal-50 text-teal-600" },
  ASSENZA_RICHIESTA: { icon: CalendarClock, className: "bg-yellow-50 text-yellow-700" },
  ASSENZA_APPROVATA: { icon: CalendarCheck, className: "bg-green-50 text-green-600" },
  ASSENZA_RIFIUTATA: { icon: CalendarX, className: "bg-red-50 text-red-600" },
  SISTEMA: { icon: Bell, className: "bg-slate-100 text-slate-600" },
};

export function NotificationIcon({ tipo, className }: { tipo: string; className?: string }) {
  const { icon: Icon, className: tone } = ICONE[tipo] ?? ICONE.SISTEMA!;
  return (
    <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full", tone, className)}>
      <Icon className="h-5 w-5" />
    </span>
  );
}
