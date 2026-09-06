import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function PortalePage() {
  return (
    <>
      <PageHeader title="I tuoi documenti" />
      <EmptyState title="Area in costruzione" description="Qui potrai caricare i documenti nelle cartelle predisposte dallo studio." />
    </>
  );
}
