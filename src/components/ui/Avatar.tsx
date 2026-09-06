import { cn, initials } from "@/lib/utils";

export function Avatar({ nome, colore, size = "md", className }: { nome: string; colore?: string | null; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  const sizes = { xs: "h-6 w-6 text-[10px]", sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-lg" };
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", sizes[size], className)}
      style={{ backgroundColor: colore ?? "#64748b" }}
      title={nome}
      aria-label={nome}
    >
      {initials(nome)}
    </span>
  );
}
