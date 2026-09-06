import { FileArchive, FileCode2, FileImage, FileSpreadsheet, FileText, File as FileGeneric } from "lucide-react";
import { cn } from "@/lib/utils";
import { fileKind } from "./shared";

/** Icona colorata in base al tipo di file. */
export function FileIcon({ nome, mimeType, className }: { nome: string; mimeType: string; className?: string }) {
  const kind = fileKind(nome, mimeType);
  const cls = cn("h-5 w-5 shrink-0", className);
  switch (kind) {
    case "pdf":
      return <FileText className={cn(cls, "text-red-500")} />;
    case "image":
      return <FileImage className={cn(cls, "text-purple-500")} />;
    case "sheet":
      return <FileSpreadsheet className={cn(cls, "text-green-600")} />;
    case "doc":
      return <FileText className={cn(cls, "text-blue-600")} />;
    case "archive":
      return <FileArchive className={cn(cls, "text-amber-600")} />;
    case "xml":
      return <FileCode2 className={cn(cls, "text-teal-600")} />;
    default:
      return <FileGeneric className={cn(cls, "text-slate-400")} />;
  }
}
