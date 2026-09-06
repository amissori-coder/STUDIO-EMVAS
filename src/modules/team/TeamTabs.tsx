import { Tabs } from "@/components/ui/Tabs";

/** Navigazione tra Team e Assenze (la tab attiva è indicata dalla pagina, dato che /team è prefisso di /team/assenze). */
export function TeamTabs({ active, pendingAbsences = 0 }: { active: "team" | "assenze"; pendingAbsences?: number }) {
  return (
    <Tabs
      className="mb-5"
      param="sezione"
      defaultKey={active}
      items={[
        { key: "team", label: "Collaboratori", href: "/team" },
        {
          key: "assenze",
          label: "Assenze",
          href: "/team/assenze",
          badge: pendingAbsences > 0 ? <span className="rounded-full bg-yellow-100 px-1.5 text-[11px] font-semibold text-yellow-800">{pendingAbsences}</span> : undefined,
        },
      ]}
    />
  );
}
