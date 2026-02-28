import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications, vacationDays, users } from "@/lib/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { getUserFromAuthHeader } from "@/lib/authz";
import { VACATION_COLORS, type VacationColor } from "@/lib/vacations";
import { doctors } from "@/lib/db/schema";

const isVacationColor = (value: string): value is VacationColor =>
  (VACATION_COLORS as readonly string[]).includes(value);

const parseYear = (value: string | null): number | null => {
  if (!value) return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1970) return null;
  return year;
};

const toYearRange = (year: number) => {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
};

const createNotificationsForDoctor = async (
  doctorId: number,
  message: string,
) => {
  const recipients = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.doctorId, doctorId));

  if (recipients.length === 0) return;

  await db
    .insert(notifications)
    .values(recipients.map((recipient) => ({ userId: recipient.id, message })));
};

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromAuthHeader(
      request.headers.get("authorization"),
    );
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year =
      parseYear(searchParams.get("year")) ?? new Date().getFullYear();
    const { start, end } = toYearRange(year);

    const isApprover = user.role === "secretary";

    if (!isApprover && !user.doctorId) {
      return NextResponse.json({ error: "Doctor required" }, { status: 403 });
    }

    const rows = isApprover
      ? await db
          .select({
            id: vacationDays.id,
            doctorId: vacationDays.doctorId,
            date: vacationDays.date,
            color: vacationDays.color,
            approved: vacationDays.approved,
            doctorName: doctors.name,
          })
          .from(vacationDays)
          .leftJoin(doctors, eq(vacationDays.doctorId, doctors.id))
          .where(and(gte(vacationDays.date, start), lte(vacationDays.date, end)))
      : await db
          .select({
            id: vacationDays.id,
            doctorId: vacationDays.doctorId,
            date: vacationDays.date,
            color: vacationDays.color,
            approved: vacationDays.approved,
          })
          .from(vacationDays)
          .where(
            and(
              eq(vacationDays.doctorId, user.doctorId as number),
              gte(vacationDays.date, start),
              lte(vacationDays.date, end),
            ),
          );

    return NextResponse.json(rows, { status: 200 });
  } catch (error) {
    console.error("Error fetching vacation days:", error);
    return NextResponse.json(
      { error: "Failed to fetch vacation days" },
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
    if (user.role === "secretary") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!user.doctorId) {
      return NextResponse.json({ error: "Doctor required" }, { status: 403 });
    }
    const doctorId = user.doctorId;

    const body = await request.json();
    const year = parseYear(String(body?.year ?? ""));
    if (!year) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }
    if (!Array.isArray(body?.days)) {
      return NextResponse.json({ error: "Days array is required" }, { status: 400 });
    }

    const { start, end } = toYearRange(year);
    type VacationInput = { date: string; color: string };
    const normalized: VacationInput[] = body.days
      .map((entry: { date?: unknown; color?: unknown }) => {
        const date = typeof entry?.date === "string" ? entry.date : null;
        const color = typeof entry?.color === "string" ? entry.color : null;
        if (!date || !color) return null;
        if (!date.startsWith(`${year}-`)) return null;
        if (!isVacationColor(color)) return null;
        return { date, color } as VacationInput;
      })
      .filter(
        (
          entry: VacationInput | null,
        ): entry is VacationInput => entry !== null,
      );

    const existing = await db
      .select({ date: vacationDays.date, approved: vacationDays.approved })
      .from(vacationDays)
      .where(
        and(
          eq(vacationDays.doctorId, doctorId),
          gte(vacationDays.date, start),
          lte(vacationDays.date, end),
        ),
      );

    const approvalMap = new Map(existing.map((row) => [row.date, row.approved]));

    await db
      .delete(vacationDays)
      .where(
        and(
          eq(vacationDays.doctorId, doctorId),
          gte(vacationDays.date, start),
          lte(vacationDays.date, end),
        ),
      );

    if (normalized.length > 0) {
      await db.insert(vacationDays).values(
        normalized.map((entry) => ({
          doctorId,
          date: entry.date,
          color: entry.color,
          approved: approvalMap.get(entry.date) ?? false,
        })),
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error updating vacation days:", error);
    return NextResponse.json(
      { error: "Failed to update vacation days" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromAuthHeader(
      request.headers.get("authorization"),
    );
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "secretary") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    if (typeof body?.approved !== "boolean") {
      return NextResponse.json(
        { error: "Approved must be boolean" },
        { status: 400 },
      );
    }

    const updated = await db
      .update(vacationDays)
      .set({ approved: body.approved })
      .where(eq(vacationDays.id, id))
      .returning({
        id: vacationDays.id,
        doctorId: vacationDays.doctorId,
        date: vacationDays.date,
        approved: vacationDays.approved,
      })
      .get();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (updated.approved) {
      await createNotificationsForDoctor(
        updated.doctorId,
        `Your vacation on ${updated.date} was approved.`,
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error updating vacation approval:", error);
    return NextResponse.json(
      { error: "Failed to update vacation approval" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromAuthHeader(
      request.headers.get("authorization"),
    );
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "secretary") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = await db
      .select({
        id: vacationDays.id,
        doctorId: vacationDays.doctorId,
        date: vacationDays.date,
      })
      .from(vacationDays)
      .where(eq(vacationDays.id, id))
      .get();

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.delete(vacationDays).where(eq(vacationDays.id, id));

    await createNotificationsForDoctor(
      existing.doctorId,
      `Your vacation on ${existing.date} was denied.`,
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error denying vacation:", error);
    return NextResponse.json(
      { error: "Failed to deny vacation" },
      { status: 500 },
    );
  }
}
