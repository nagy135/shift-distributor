import { getUserFromAuthHeader } from "@/lib/authz";
import { isDateKey } from "@/lib/dates";
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
    const params = request.nextUrl.searchParams;
    const date = params.get("date"),
      start = params.get("start"),
      end = params.get("end");
    requireValue(!date || isDateKey(date), "Ungültiges Datum.");
    requireValue(
      (!start && !end) || (isDateKey(start) && isDateKey(end) && start <= end),
      "Ungültiger Zeitraum.",
    );
    const rows = db
      .select()
      .from(shifts)
      .where(
        date
          ? eq(shifts.date, date)
          : start && end
            ? and(gte(shifts.date, start), lte(shifts.date, end))
            : undefined,
      )
      .all();
    const unpublished =
      user.role === "doctor"
        ? await listUnpublishedMonths()
        : new Set<string>();
    return NextResponse.json(
      await hydrateShiftRows(
        rows.filter((row) => !unpublished.has(row.date.slice(0, 7))),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}

async function write(request: NextRequest, batch: boolean) {
  try {
    const user = await getUserFromAuthHeader(
      request.headers.get("authorization"),
    );
    requireValue(user, "Bitte anmelden.", 401);
    const body = await readBody(request);
    const rows = saveAssignments(db, user, batch ? body.shifts : [body]);
    const hydrated = await hydrateShiftRows(rows);
    return NextResponse.json(batch ? hydrated : hydrated[0]);
  } catch (error) {
    return apiError(error);
  }
}
export const POST = (request: NextRequest) => write(request, false);
export const PUT = (request: NextRequest) => write(request, true);
