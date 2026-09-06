import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Page() {
  return (
    <>
      <PageHeader title="Dashboard" />
      <EmptyState title="Sezione in costruzione" description="Questa pagina verrà completata a breve." />
    </>
  );
}
