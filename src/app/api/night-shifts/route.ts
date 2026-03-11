import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { getUserFromAuthHeader } from "@/lib/authz";
import { db } from "@/lib/db";
import { shifts } from "@/lib/db/schema";
import { isAssigner } from "@/lib/roles";
import { hydrateShiftRows, parseDoctorIds } from "@/lib/server/shift-route-helpers";

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

const hydrateNightShifts = async (rows: ShiftRow[]): Promise<ApiNightShift[]> => {
  const hydratedRows = await hydrateShiftRows(rows);

  return hydratedRows.map((row) => ({
    ...row,
    shiftType: "night",
  }));
};

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromAuthHeader(
      request.headers.get("authorization"),
    );
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const canManage = user.role === "secretary" || isAssigner(user.role);
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
    if (user.role !== "secretary" && !isAssigner(user.role)) {
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
