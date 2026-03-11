import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { doctors, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUserFromAuthHeader } from "@/lib/authz";
import { isAssigner } from "@/lib/roles";

const ONLINE_WINDOW_MS = 30 * 1000;

export async function GET(request: NextRequest) {
  const user = await getUserFromAuthHeader(
    request.headers.get("authorization"),
  );
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAssigner(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = Date.now();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      doctorId: users.doctorId,
      doctorName: doctors.name,
      lastOnlineAt: users.lastOnlineAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(doctors, eq(users.doctorId, doctors.id));

  return NextResponse.json(
    rows.map((row) => {
      const lastOnlineAt = row.lastOnlineAt ? new Date(row.lastOnlineAt) : null;

      return {
        ...row,
        isOnline:
          lastOnlineAt !== null &&
          now - lastOnlineAt.getTime() <= ONLINE_WINDOW_MS,
      };
    }),
    { status: 200 },
  );
}
