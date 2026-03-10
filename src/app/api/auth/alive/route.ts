import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getUserFromAuthHeader } from "@/lib/authz";

export async function POST(request: NextRequest) {
  const user = await getUserFromAuthHeader(
    request.headers.get("authorization"),
  );

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .update(users)
    .set({ lastOnlineAt: new Date() })
    .where(eq(users.id, user.id));

  return new NextResponse(null, { status: 204 });
}
