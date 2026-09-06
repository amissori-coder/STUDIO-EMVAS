import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { CalendarDays } from "lucide-react";
import { StaffList } from "@/modules/team/StaffList";
import { TeamTabs } from "@/modules/team/TeamTabs";
import { countPendingAbsences, listStaff } from "@/modules/team/queries";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const user = await requireStaff();
  const isAdmin = user.ruolo === "ADMIN";
  const [staff, pending] = await Promise.all([listStaff(), isAdmin ? countPendingAbsences() : Promise.resolve(0)]);
  const attivi = staff.filter((s) => s.attivo).length;

  return (
    <>
      <PageHeader
        title="Team e assenze"
        description={`${attivi} ${attivi === 1 ? "collaboratore attivo" : "collaboratori attivi"} nello studio.`}
        actions={
          <Button href="/team/assenze" variant="outline">
            <CalendarDays className="h-4 w-4" /> Pianificazione assenze
          </Button>
        }
      />
      <TeamTabs active="team" pendingAbsences={pending} />
      <StaffList staff={staff} isAdmin={isAdmin} currentUserId={user.id} />
    </>
  );
}
