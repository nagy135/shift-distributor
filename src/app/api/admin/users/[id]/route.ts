import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { doctors, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUserFromAuthHeader } from "@/lib/authz";
import { USER_ROLES, type UserRole } from "@/lib/roles";

function parseUserId(value: string): number | null {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getUserFromAuthHeader(
    request.headers.get("authorization"),
  );
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (admin.role !== "shift_assigner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseUserId(id);
  if (!userId) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const body = await request.json();
  const updates: { role?: UserRole; doctorId?: number | null } = {};

  if (Object.prototype.hasOwnProperty.call(body, "role")) {
    const role = String(body.role || "").toLowerCase();
    if (!USER_ROLES.includes(role as UserRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    updates.role = role as UserRole;
  }

  if (Object.prototype.hasOwnProperty.call(body, "doctorId")) {
    if (body.doctorId === null) {
      updates.doctorId = null;
    } else {
      const doctorId = Number(body.doctorId);
      if (!Number.isInteger(doctorId) || doctorId <= 0) {
        return NextResponse.json(
          { error: "Invalid doctor id" },
          { status: 400 },
        );
      }
      const doctorExists = await db
        .select({ id: doctors.id })
        .from(doctors)
        .where(eq(doctors.id, doctorId))
        .get();
      if (!doctorExists) {
        return NextResponse.json(
          { error: "Doctor not found" },
          { status: 404 },
        );
      }
      updates.doctorId = doctorId;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid updates provided" },
      { status: 400 },
    );
  }

  const updated = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, userId))
    .returning({ id: users.id })
    .get();

  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updatedWithDoctor = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      doctorId: users.doctorId,
      doctorName: doctors.name,
    })
    .from(users)
    .leftJoin(doctors, eq(users.doctorId, doctors.id))
    .where(eq(users.id, userId))
    .get();

  return NextResponse.json(updatedWithDoctor, { status: 200 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getUserFromAuthHeader(
    request.headers.get("authorization"),
  );
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (admin.role !== "shift_assigner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseUserId(id);
  if (!userId) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const deleted = await db
    .delete(users)
    .where(eq(users.id, userId))
    .returning({ id: users.id })
    .get();

  if (!deleted) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
