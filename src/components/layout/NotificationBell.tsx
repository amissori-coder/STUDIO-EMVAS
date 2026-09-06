"use client";
import Link from "next/link";
import useSWR from "swr";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : { count: 0 }));

export function NotificationBell({ href = "/notifiche" }: { href?: string }) {
  const { data } = useSWR<{ count: number }>("/api/notifiche/unread", fetcher, { refreshInterval: 30_000 });
  const count = data?.count ?? 0;
  return (
    <Link href={href} className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100" aria-label={`Notifiche${count ? ` (${count} non lette)` : ""}`}>
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className={cn("absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white")}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
