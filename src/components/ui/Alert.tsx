import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = "info" | "success" | "warning" | "error";
const styles: Record<Kind, string> = {
  info: "bg-blue-50 text-blue-800 border-blue-200",
  success: "bg-green-50 text-green-800 border-green-200",
  warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
  error: "bg-red-50 text-red-800 border-red-200",
};
const icons: Record<Kind, ReactNode> = {
  info: <Info className="h-5 w-5" />,
  success: <CheckCircle2 className="h-5 w-5" />,
  warning: <AlertTriangle className="h-5 w-5" />,
  error: <XCircle className="h-5 w-5" />,
};

export function Alert({ kind = "info", title, children, className }: { kind?: Kind; title?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", styles[kind], className)}>
      <div className="mt-0.5 shrink-0">{icons[kind]}</div>
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
    </div>
  );
}
