import {
  Bell,
  Briefcase,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  Mail,
  MessageSquare,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** solo per amministratori */
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clienti", label: "Clienti", icon: Briefcase },
  { href: "/attivita", label: "Attività", icon: ListChecks },
  { href: "/scadenzario", label: "Scadenzario", icon: CalendarDays },
  { href: "/email", label: "Email", icon: Mail },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/team", label: "Team e assenze", icon: Users },
  { href: "/adempimenti", label: "Adempimenti", icon: ClipboardList },
  { href: "/notifiche", label: "Notifiche", icon: Bell },
  { href: "/impostazioni", label: "Impostazioni", icon: Settings },
];

/** Voci mostrate nella barra inferiore su mobile (le altre finiscono nel menu "Altro"). */
export const MOBILE_PRIMARY = ["/dashboard", "/clienti", "/attivita", "/chat"];
