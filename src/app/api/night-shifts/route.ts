import { getUserFromAuthHeader } from "@/lib/authz";
import { parseYear, yearRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { shifts } from "@/lib/db/schema";
import { listUnpublishedMonths } from "@/lib/month-publications";
import { saveAssignments } from "@/lib/server/assignment-service";
import { apiError, readBody, requireValue } from "@/lib/server/errors";
import { hydrateShiftRows } from "@/lib/server/shift-route-helpers";
import { and, eq, gte, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromAuthHeader(
      request.headers.get("authorization"),
    );
    requireValue(user, "Bitte anmelden.", 401);
    const value = request.nextUrl.searchParams.get("year");
    const year = value === null ? new Date().getFullYear() : parseYear(value);
    requireValue(year, "Ungültiges Jahr.");
    const { start, end } = yearRange(year);
    const unpublished =
      user.role === "doctor"
        ? await listUnpublishedMonths()
        : new Set<string>();
    const rows = db
      .select()
      .from(shifts)
      .where(
        and(
          eq(shifts.shiftType, "night"),
          gte(shifts.date, start),
          lte(shifts.date, end),
        ),
      )
      .all();
    return NextResponse.json(
      await hydrateShiftRows(
        rows.filter((row) => !unpublished.has(row.date.slice(0, 7))),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromAuthHeader(
      request.headers.get("authorization"),
    );
    requireValue(user, "Bitte anmelden.", 401);
    const body = await readBody(request);
    const rows = saveAssignments(
      db,
      user,
      [{ ...body, shiftType: "night" }],
      true,
    );
    return NextResponse.json((await hydrateShiftRows(rows))[0]);
  } catch (error) {
    return apiError(error);
  }
}
