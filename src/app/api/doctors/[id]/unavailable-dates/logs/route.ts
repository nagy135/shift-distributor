import { NextRequest, NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  unavailableDateChangeLogEntries,
  unavailableDateChangeLogs,
  users,
} from "@/lib/db/schema";
import { getUserFromAuthHeader } from "@/lib/authz";
import { isAssigner } from "@/lib/roles";

function toDateString(month: string, dayInMonth: number) {
  return `${month}-${String(dayInMonth).padStart(2, "0")}`;
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
    if (!isAssigner(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const doctorId = parseInt(id);

    const logs = await db
      .select({
        id: unavailableDateChangeLogs.id,
        doctorId: unavailableDateChangeLogs.doctorId,
        userId: unavailableDateChangeLogs.userId,
        userEmail: users.email,
        addedCount: unavailableDateChangeLogs.addedCount,
        removedCount: unavailableDateChangeLogs.removedCount,
        createdAt: unavailableDateChangeLogs.createdAt,
      })
      .from(unavailableDateChangeLogs)
      .innerJoin(users, eq(unavailableDateChangeLogs.userId, users.id))
      .where(eq(unavailableDateChangeLogs.doctorId, doctorId))
      .orderBy(desc(unavailableDateChangeLogs.createdAt));

    if (logs.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    const logIds = logs.map((log) => log.id);
    const entries = await db
      .select({
        logId: unavailableDateChangeLogEntries.logId,
        month: unavailableDateChangeLogEntries.month,
        dayInMonth: unavailableDateChangeLogEntries.dayInMonth,
        changeType: unavailableDateChangeLogEntries.changeType,
      })
      .from(unavailableDateChangeLogEntries)
      .where(inArray(unavailableDateChangeLogEntries.logId, logIds));

    const entriesByLogId = new Map<number, Array<{ date: string; changeType: "added" | "removed" }>>();

    for (const entry of entries) {
      const current = entriesByLogId.get(entry.logId) ?? [];
      current.push({
        date: toDateString(entry.month, entry.dayInMonth),
        changeType: entry.changeType,
      });
      entriesByLogId.set(entry.logId, current);
    }

    return NextResponse.json(
      logs.map((log) => ({
        ...log,
        changes: (entriesByLogId.get(log.id) ?? []).sort((left, right) =>
          left.date.localeCompare(right.date),
        ),
      })),
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching unavailable date logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch unavailable date logs" },
      { status: 500 },
    );
  }
}
