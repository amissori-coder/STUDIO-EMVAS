import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { AuthError, requireUserAction, type CurrentUser } from "@/lib/auth/guards";
import { readUpload, streamUpload, uploadExists } from "@/lib/storage";
import { canUserDeleteDocument, canUserViewDocument, contentDisposition, removeDocument } from "@/modules/documenti/service";
import { isInlineMime } from "@/modules/documenti/shared";

export const runtime = "nodejs";

const READ_IN_MEMORY_MAX = 25 * 1024 * 1024;

async function guard(): Promise<{ user: CurrentUser } | { response: NextResponse }> {
  try {
    return { user: await requireUserAction() };
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 401;
    return { response: NextResponse.json({ error: (e as Error).message }, { status }) };
  }
}

/**
 * Scarica / apre un documento. Staff: qualsiasi documento; cliente: solo documenti dei propri clienti
 * in cartelle visibili (o caricati da lui). Per evitare enumerazioni, ai clienti risponde 404 anche
 * per i documenti esistenti ma non accessibili.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/documenti/[id]">) {
  const g = await guard();
  if ("response" in g) return g.response;
  const { id } = await ctx.params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Documento non trovato" }, { status: 404 });
  if (!(await canUserViewDocument(g.user, doc))) {
    return NextResponse.json({ error: "Documento non trovato" }, { status: 404 });
  }
  if (!(await uploadExists(doc.storagePath))) {
    return NextResponse.json({ error: "File non presente nell'archivio" }, { status: 404 });
  }

  const inline = isInlineMime(doc.mimeType);
  const headers = new Headers({
    "Content-Type": doc.mimeType || "application/octet-stream",
    "Content-Disposition": contentDisposition(doc.nome, inline),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });

  try {
    if (doc.size <= READ_IN_MEMORY_MAX) {
      const buf = await readUpload(doc.storagePath);
      headers.set("Content-Length", String(buf.length));
      return new NextResponse(new Uint8Array(buf), { status: 200, headers });
    }
    headers.set("Content-Length", String(doc.size));
    const stream = Readable.toWeb(streamUpload(doc.storagePath)) as ReadableStream;
    return new NextResponse(stream, { status: 200, headers });
  } catch (e) {
    console.error("[documenti] lettura file fallita:", e);
    return NextResponse.json({ error: "File non leggibile" }, { status: 404 });
  }
}

/** Elimina un documento: lo staff qualsiasi, il cliente solo i propri caricamenti. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/documenti/[id]">) {
  const g = await guard();
  if ("response" in g) return g.response;
  const { id } = await ctx.params;
  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, clientId: true, nome: true, storagePath: true, folderId: true, daCliente: true, uploadedById: true },
  });
  if (!doc) return NextResponse.json({ error: "Documento non trovato" }, { status: 404 });
  if (!(await canUserViewDocument(g.user, doc))) return NextResponse.json({ error: "Documento non trovato" }, { status: 404 });
  if (!canUserDeleteDocument(g.user, doc)) return NextResponse.json({ error: "Non puoi eliminare questo documento" }, { status: 403 });
  await removeDocument(g.user, doc);
  revalidatePath(`/clienti/${doc.clientId}`);
  revalidatePath("/portale");
  if (doc.folderId) revalidatePath(`/portale/cartelle/${doc.folderId}`);
  return NextResponse.json({ ok: true });
}
