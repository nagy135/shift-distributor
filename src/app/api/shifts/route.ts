import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shifts } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getUserFromAuthHeader } from "@/lib/authz";
import { listUnpublishedMonths } from "@/lib/month-publications";
import { canAssignCalendarShiftType, isAssigner } from "@/lib/roles";
import { hydrateShiftRows, parseDoctorIds } from "@/lib/server/shift-route-helpers";

type ShiftRow = typeof shifts.$inferSelect;

interface ApiShift {
  id: number;
  date: string;
  shiftType: string;
  doctorIds: number[];
  doctors: Array<{ id: number; name: string; color: string | null }>;
}

const hydrateShifts = (rows: ShiftRow[]): Promise<ApiShift[]> => hydrateShiftRows(rows);

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromAuthHeader(
      request.headers.get("authorization"),
    );
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const unpublishedMonths =
      user.role === "doctor" ? await listUnpublishedMonths() : null;

    const canDoctorViewDate = (value: string) => {
      if (user.role !== "doctor") {
        return true;
      }

      return !(unpublishedMonths?.has(value.slice(0, 7)) ?? false);
    };

    if (date) {
      if (!canDoctorViewDate(date)) {
        return NextResponse.json([]);
      }

      const rows = await db.select().from(shifts).where(eq(shifts.date, date));

      const result = await hydrateShifts(rows);

      return NextResponse.json(result);
    } else {
      const rows = await db.select().from(shifts);
      const visibleRows =
        user.role === "doctor"
          ? rows.filter((row) => canDoctorViewDate(row.date))
          : rows;
      const result = await hydrateShifts(visibleRows);

      return NextResponse.json(result);
    }
  } catch (error) {
    console.error("Error fetching shifts:", error);
    return NextResponse.json(
      { error: "Failed to fetch shifts" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromAuthHeader(
      request.headers.get("authorization"),
    );
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAssigner(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { date, shiftType, doctorIds } = await request.json();

    if (!date || !shiftType) {
      return NextResponse.json(
        { error: "Date and shiftType are required" },
        { status: 400 },
      );
    }

    if (!canAssignCalendarShiftType(user.role, shiftType)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const normalizedDoctorIds = parseDoctorIds(doctorIds);

    // Check if a shift already exists for this date and type
    const existingShift = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.date, date), eq(shifts.shiftType, shiftType)));

    if (existingShift.length > 0) {
      const [updatedShift] = await db
        .update(shifts)
        .set({ doctorIds: normalizedDoctorIds })
        .where(eq(shifts.id, existingShift[0].id))
        .returning();

      const [hydrated] = await hydrateShifts([updatedShift]);

      return NextResponse.json(hydrated);
    } else {
      const [newShift] = await db
        .insert(shifts)
        .values({ date, shiftType, doctorIds: normalizedDoctorIds })
        .returning();

      const [hydrated] = await hydrateShifts([newShift]);

      return NextResponse.json(hydrated, { status: 201 });
    }
  } catch (error) {
    console.error("Error creating/updating shift:", error);
    return NextResponse.json(
      { error: "Failed to create/update shift" },
      { status: 500 },
    );
  }
}

interface BulkShiftInput {
  date: string;
  shiftType: string;
  doctorIds: unknown;
}

// PUT - Bulk upsert shifts (for distribute functionality)
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromAuthHeader(
      request.headers.get("authorization"),
    );
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAssigner(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    if (!Array.isArray(body.shifts)) {
      return NextResponse.json(
        { error: "shifts array is required" },
        { status: 400 },
      );
    }

    const inputShifts: BulkShiftInput[] = body.shifts;

    // Validate all inputs first
    for (const shift of inputShifts) {
      if (!shift.date || !shift.shiftType) {
        return NextResponse.json(
          { error: "Each shift must have date and shiftType" },
          { status: 400 },
        );
      }

      if (!canAssignCalendarShiftType(user.role, shift.shiftType)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Get all existing shifts for the dates we're updating
    const uniqueDates = [...new Set(inputShifts.map((s) => s.date))];
    const existingShifts = await db
      .select()
      .from(shifts)
      .where(inArray(shifts.date, uniqueDates));

    // Build a lookup map: "date|shiftType" -> existing shift
    const existingMap = new Map<string, ShiftRow>();
    for (const shift of existingShifts) {
      existingMap.set(`${shift.date}|${shift.shiftType}`, shift);
    }

    const results: ShiftRow[] = [];

    // Process each shift - update existing or insert new
    for (const input of inputShifts) {
      const key = `${input.date}|${input.shiftType}`;
      const normalizedDoctorIds = parseDoctorIds(input.doctorIds);
      const existing = existingMap.get(key);

      if (existing) {
        const [updated] = await db
          .update(shifts)
          .set({ doctorIds: normalizedDoctorIds })
          .where(eq(shifts.id, existing.id))
          .returning();
        results.push(updated);
      } else {
        const [inserted] = await db
          .insert(shifts)
          .values({
            date: input.date,
            shiftType: input.shiftType,
            doctorIds: normalizedDoctorIds,
          })
          .returning();
        results.push(inserted);
      }
    }

    const hydrated = await hydrateShifts(results);
    return NextResponse.json(hydrated);
  } catch (error) {
    console.error("Error bulk upserting shifts:", error);
    return NextResponse.json(
      { error: "Failed to bulk upsert shifts" },
      { status: 500 },
    );
  }
}
