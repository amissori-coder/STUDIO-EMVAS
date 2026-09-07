import { Spinner } from "@/components/ui/Spinner";

export default function StudioLoading() {
  return (
    <div className="flex items-center justify-center py-20 text-slate-500" role="status" aria-live="polite">
      <Spinner className="mr-2 h-5 w-5" />
      Caricamento…
    </div>
  );
}
