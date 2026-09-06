import type { ReactNode } from "react";
import { requireStaff } from "@/lib/auth/guards";
import { AppShell } from "@/components/layout/AppShell";

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const user = await requireStaff();
  return <AppShell user={user}>{children}</AppShell>;
}
