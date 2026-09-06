import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { countUnreadNotifications } from "@/lib/notifications";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ count: 0 }, { status: 401 });
  return NextResponse.json({ count: await countUnreadNotifications(user.id) });
}
