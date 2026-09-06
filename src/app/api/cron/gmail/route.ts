import { NextResponse, type NextRequest } from "next/server";
import { syncAllGoogleAccounts } from "@/lib/gmail";
import { getCurrentUser, isAdmin } from "@/lib/auth/guards";

async function handler(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const bySecret = !!secret && (auth === `Bearer ${secret}` || request.nextUrl.searchParams.get("secret") === secret);
  if (!bySecret && !isAdmin(await getCurrentUser())) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  return NextResponse.json(await syncAllGoogleAccounts());
}

export const GET = handler;
export const POST = handler;
