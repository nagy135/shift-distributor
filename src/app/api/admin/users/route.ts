import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { doctors, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUserFromAuthHeader } from "@/lib/authz";

export async function GET(request: NextRequest) {
  const user = await getUserFromAuthHeader(
    request.headers.get("authorization"),
  );
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "shift_assigner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      doctorId: users.doctorId,
      doctorName: doctors.name,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(doctors, eq(users.doctorId, doctors.id));

  return NextResponse.json(rows, { status: 200 });
}
