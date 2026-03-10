import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { getUserFromAuthHeader } from "@/lib/authz";
import { db } from "@/lib/db";
import { doctors, shifts } from "@/lib/db/schema";

type ShiftRow = typeof shifts.$inferSelect;

interface ApiNightShift {
  id: number;
  date: string;
  shiftType: "night";
  doctorIds: number[];
  doctors: Array<{ id: number; name: string; color: string | null }>;
}

const parseYear = (value: string | null): number | null => {
  if (!value) return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1970) return null;
  return year;
};

const toYearRange = (year: number) => ({
  start: `${year}-01-01`,
  end: `${year}-12-31`,
});

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

const hydrateNightShifts = async (rows: ShiftRow[]): Promise<ApiNightShift[]> => {
  const doctorIds = Array.from(
    new Set(
      rows.flatMap((row) =>
        Array.isArray(row.doctorIds)
          ? row.doctorIds.filter(
              (doctorId): doctorId is number => typeof doctorId === "number",
            )
          : [],
      ),
    ),
  );

  const doctorMap = new Map<number, { id: number; name: string; color: string | null }>();

  if (doctorIds.length > 0) {
    const doctorRows = await db
      .select({
        id: doctors.id,
        name: doctors.name,
        color: doctors.color,
      })
      .from(doctors)
      .where(inArray(doctors.id, doctorIds));

    for (const doctor of doctorRows) {
      doctorMap.set(doctor.id, {
        id: doctor.id,
        name: doctor.name,
        color: doctor.color ?? null,
      });
    }
  }

  return rows.map((row) => {
    const normalizedDoctorIds = Array.isArray(row.doctorIds)
      ? row.doctorIds.filter(
          (doctorId): doctorId is number => typeof doctorId === "number",
        )
      : [];

    return {
      id: row.id,
      date: row.date,
      shiftType: "night",
      doctorIds: normalizedDoctorIds,
      doctors: normalizedDoctorIds.map((doctorId) => {
        const doctor = doctorMap.get(doctorId);
        return doctor ?? { id: doctorId, name: `Doctor #${doctorId}`, color: null };
      }),
    };
  });
};

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromAuthHeader(
      request.headers.get("authorization"),
    );
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const canManage =
      user.role === "secretary" || user.role === "shift_assigner";
    const canView = canManage || user.role === "doctor";

    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const year =
      parseYear(searchParams.get("year")) ?? new Date().getFullYear();
    const { start, end } = toYearRange(year);

    const rows = await db
      .select()
      .from(shifts)
      .where(
        and(
          eq(shifts.shiftType, "night"),
          gte(shifts.date, start),
          lte(shifts.date, end),
        ),
      );

    const hydratedRows = await hydrateNightShifts(rows);

    return NextResponse.json(hydratedRows);
  } catch (error) {
    console.error("Error fetching night shifts:", error);
    return NextResponse.json(
      { error: "Failed to fetch night shifts" },
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
    if (user.role !== "secretary" && user.role !== "shift_assigner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const date = typeof body?.date === "string" ? body.date : "";
    const doctorIds = parseDoctorIds(body?.doctorIds);

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.date, date), eq(shifts.shiftType, "night")))
      .get();

    const row = existing
      ? await db
          .update(shifts)
          .set({ doctorIds })
          .where(eq(shifts.id, existing.id))
          .returning()
          .get()
      : await db
          .insert(shifts)
          .values({ date, shiftType: "night", doctorIds })
          .returning()
          .get();

    if (!row) {
      return NextResponse.json(
        { error: "Failed to update night shift" },
        { status: 500 },
      );
    }

    const [hydrated] = await hydrateNightShifts([row]);
    return NextResponse.json(hydrated);
  } catch (error) {
    console.error("Error updating night shift:", error);
    return NextResponse.json(
      { error: "Failed to update night shift" },
      { status: 500 },
    );
  }
}
