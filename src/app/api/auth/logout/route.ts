import { NextResponse, type NextRequest } from "next/server";
import { destroySession } from "@/lib/auth/session";

async function logout(request: NextRequest) {
  await destroySession();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}

export const POST = logout;
export const GET = logout;
