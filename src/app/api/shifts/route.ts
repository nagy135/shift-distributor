import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shifts, doctors } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getUserFromAuthHeader } from "@/lib/authz";

type ShiftRow = typeof shifts.$inferSelect;

interface ApiShift {
  id: number;
  date: string;
  shiftType: string;
  doctorIds: number[];
  doctors: Array<{ id: number; name: string; color: string | null }>;
}

const hydrateShifts = async (rows: ShiftRow[]): Promise<ApiShift[]> => {
  const doctorIdSet = new Set<number>();
  for (const row of rows) {
    for (const doctorId of row.doctorIds ?? []) {
      if (typeof doctorId === "number") {
        doctorIdSet.add(doctorId);
      }
    }
  }

  const doctorMap = new Map<
    number,
    { id: number; name: string; color: string | null }
  >();
  if (doctorIdSet.size > 0) {
    const ids = Array.from(doctorIdSet);
    const doctorRows = await db
      .select({
        id: doctors.id,
        name: doctors.name,
        color: doctors.color,
      })
      .from(doctors)
      .where(inArray(doctors.id, ids));

    for (const doctor of doctorRows) {
      doctorMap.set(doctor.id, {
        id: doctor.id,
        name: doctor.name,
        color: doctor.color ?? null,
      });
    }
  }

  return rows.map((row) => {
    const doctorIds = Array.isArray(row.doctorIds)
      ? row.doctorIds.filter(
          (value): value is number => typeof value === "number",
        )
      : [];

    const doctorsForShift = doctorIds.map((doctorId) => {
      const doctor = doctorMap.get(doctorId);
      return (
        doctor ?? { id: doctorId, name: `Doctor #${doctorId}`, color: null }
      );
    });

    return {
      id: row.id,
      date: row.date,
      shiftType: row.shiftType,
      doctorIds,
      doctors: doctorsForShift,
    };
  });
};

const parseDoctorIds = (input: unknown): number[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  const ids = input
    .map((value) => {
      if (typeof value === "number") {
        return value;
      }
      if (typeof value === "string" && value.trim() !== "") {
        const numeric = Number(value);
        return Number.isNaN(numeric) ? null : numeric;
      }
      return null;
    })
    .filter(
      (value): value is number => value != null && Number.isInteger(value),
    );

  return Array.from(new Set(ids));
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (date) {
      const rows = await db.select().from(shifts).where(eq(shifts.date, date));

      const result = await hydrateShifts(rows);

      return NextResponse.json(result);
    } else {
      const rows = await db.select().from(shifts);
      const result = await hydrateShifts(rows);

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
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { date, shiftType, doctorIds } = await request.json();

    if (!date || !shiftType) {
      return NextResponse.json(
        { error: "Date and shiftType are required" },
        { status: 400 },
      );
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
    if (user.role !== "admin") {
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
