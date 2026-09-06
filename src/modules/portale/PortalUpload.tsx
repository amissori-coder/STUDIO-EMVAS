"use client";
import { useRouter } from "next/navigation";
import { UploadDropzone } from "@/modules/documenti/UploadDropzone";

/** Area di caricamento del portale: al termine ricarica i dati della pagina (server component). */
export function PortalUpload({ clientId, folderId, maxBytes }: { clientId: string; folderId: string; maxBytes: number }) {
  const router = useRouter();
  return <UploadDropzone clientId={clientId} folderId={folderId} maxBytes={maxBytes} allowCamera showNote onDone={() => router.refresh()} />;
}
