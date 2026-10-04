import { getUserFromAuthHeader } from "@/lib/authz";
import { parseYear, yearRange } from "@/lib/dates";
import { db } from "@/lib/db";
import { doctors, vacationDays } from "@/lib/db/schema";
import { apiError, readBody, requireValue } from "@/lib/server/errors";
import { decideVacation, editVacations } from "@/lib/server/vacation-service";
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
    const rows = db
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
      .all();
    return NextResponse.json(rows);
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
    return NextResponse.json(editVacations(db, user, body.changes));
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromAuthHeader(
      request.headers.get("authorization"),
    );
    requireValue(user, "Bitte anmelden.", 401);
    const body = await readBody(request);
    requireValue(typeof body.approved === "boolean", "Ungültige Entscheidung.");
    return NextResponse.json(
      decideVacation(db, user, body.id, body.approved, body.expectedColor),
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromAuthHeader(
      request.headers.get("authorization"),
    );
    requireValue(user, "Bitte anmelden.", 401);
    const body = await readBody(request);
    return NextResponse.json(
      decideVacation(db, user, body.id, "deny", body.expectedColor),
    );
  } catch (error) {
    return apiError(error);
  }
}
