import { getUserFromAuthHeader } from "@/lib/authz";
import { isDateKey } from "@/lib/dates";
import { db } from "@/lib/db";
import {
  doctors,
  unavailableDateChangeLogEntries,
  unavailableDateChangeLogs,
  unavailableDates,
} from "@/lib/db/schema";
import { isAssigner } from "@/lib/roles";
import { apiError, requireValue } from "@/lib/server/errors";
import { and, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

function getMonthAndDay(date: string) {
  const [year, month, day] = date.split("-");

  return {
    month: `${year}-${month}`,
    dayInMonth: Number(day),
  };
}

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
    const doctorId = Number(id);

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
    const doctorId = Number(id);
    const { dates } = await request.json();
    requireValue(
      Number.isInteger(doctorId) &&
        doctorId > 0 &&
        db.select().from(doctors).where(eq(doctors.id, doctorId)).get(),
      "Arzt nicht gefunden.",
      404,
    );

    if (
      !isAssigner(user.role) &&
      (user.role !== "doctor" || user.doctorId !== doctorId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!dates || !Array.isArray(dates)) {
      return NextResponse.json(
        { error: "Dates array is required" },
        { status: 400 },
      );
    }

    requireValue(dates.every(isDateKey), "Ungültige Sperrtage.");
    const normalizedDates = Array.from(
      new Set(
        dates
          .filter((value): value is string => typeof value === "string")
          .sort(),
      ),
    );

    db.transaction((tx) => {
      const existingDates = tx
        .select({ date: unavailableDates.date })
        .from(unavailableDates)
        .where(eq(unavailableDates.doctorId, doctorId))
        .all();

      const existingDateSet = new Set(existingDates.map((entry) => entry.date));
      const nextDateSet = new Set(normalizedDates);
      const addedDates = normalizedDates.filter(
        (date) => !existingDateSet.has(date),
      );
      const removedDates = existingDates
        .map((entry) => entry.date)
        .filter((date) => !nextDateSet.has(date));

      if (removedDates.length)
        tx.delete(unavailableDates)
          .where(
            and(
              eq(unavailableDates.doctorId, doctorId),
              inArray(unavailableDates.date, removedDates),
            ),
          )
          .run();
      if (addedDates.length)
        tx.insert(unavailableDates)
          .values(addedDates.map((date) => ({ doctorId, date })))
          .run();

      if (addedDates.length === 0 && removedDates.length === 0) {
        return;
      }

      const insertedLog = tx
        .insert(unavailableDateChangeLogs)
        .values({
          doctorId,
          userId: user.id,
          addedCount: addedDates.length,
          removedCount: removedDates.length,
        })
        .returning({ id: unavailableDateChangeLogs.id })
        .get();

      if (!insertedLog) {
        return;
      }

      const entries = [
        ...addedDates.map((date) => ({ date, changeType: "added" as const })),
        ...removedDates.map((date) => ({
          date,
          changeType: "removed" as const,
        })),
      ].map(({ date, changeType }) => {
        const { month, dayInMonth } = getMonthAndDay(date);

        return {
          logId: insertedLog.id,
          month,
          dayInMonth,
          changeType,
        } as const;
      });

      tx.insert(unavailableDateChangeLogEntries).values(entries).run();
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
