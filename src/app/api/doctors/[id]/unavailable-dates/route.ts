import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { unavailableDates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUserFromAuthHeader } from "@/lib/authz";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUserFromAuthHeader(
      request.headers.get("authorization"),
    );
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const doctorId = parseInt(id);

    const dates = await db
      .select()
      .from(unavailableDates)
      .where(eq(unavailableDates.doctorId, doctorId));

    return NextResponse.json(dates);
  } catch (error) {
    console.error("Error fetching unavailable dates:", error);
    return NextResponse.json(
      { error: "Failed to fetch unavailable dates" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUserFromAuthHeader(
      request.headers.get("authorization"),
    );
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const doctorId = parseInt(id);
    const { dates } = await request.json();

    if (
      user.role !== "shift_assigner" &&
      (!user.doctorId || user.doctorId !== doctorId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!dates || !Array.isArray(dates)) {
      return NextResponse.json(
        { error: "Dates array is required" },
        { status: 400 },
      );
    }

    // Delete existing unavailable dates for this doctor
    await db
      .delete(unavailableDates)
      .where(eq(unavailableDates.doctorId, doctorId));

    // Insert new unavailable dates
    if (dates.length > 0) {
      const unavailableDatesToInsert = dates.map((date: string) => ({
        doctorId,
        date,
      }));

      await db.insert(unavailableDates).values(unavailableDatesToInsert);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating unavailable dates:", error);
    return NextResponse.json(
      { error: "Failed to update unavailable dates" },
      { status: 500 },
    );
  }
}
