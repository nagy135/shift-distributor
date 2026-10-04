import { getUserFromAuthHeader } from "@/lib/authz";
import { isDateKey } from "@/lib/dates";
import { db } from "@/lib/db";
import {
  doctors,
  unavailableDates,
  type Doctor,
  type NewDoctor,
} from "@/lib/db/schema";
import { isAssigner } from "@/lib/roles";
import { apiError, readBody, requireValue } from "@/lib/server/errors";
import { ALL_CALENDAR_SHIFT_TYPES } from "@/lib/shifts";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

const doctorDto = (doctor: Doctor) => ({
  ...doctor,
  createdAt: doctor.createdAt?.toISOString() ?? null,
});
function validateFields(body: Record<string, unknown>) {
  requireValue(
    body.name === undefined ||
      (typeof body.name === "string" &&
        body.name.trim().length > 0 &&
        body.name.length <= 200),
    "Bitte Namen angeben.",
  );
  requireValue(
    body.color === undefined ||
      body.color === null ||
      (typeof body.color === "string" && body.color.length <= 64),
    "Ungültige Farbe.",
  );
  requireValue(
    body.unavailableShiftTypes === undefined ||
      (Array.isArray(body.unavailableShiftTypes) &&
        body.unavailableShiftTypes.every(
          (value) =>
            typeof value === "string" &&
            ALL_CALENDAR_SHIFT_TYPES.includes(value),
        )),
    "Ungültige Dienstsperren.",
  );
  requireValue(
    body.disabled === undefined || typeof body.disabled === "boolean",
    "Ungültige Einstellung.",
  );
  requireValue(
    body.oa === undefined || typeof body.oa === "boolean",
    "Ungültige Einstellung.",
  );
}
export async function GET(request: NextRequest) {
  try {
    requireValue(
      await getUserFromAuthHeader(request.headers.get("authorization")),
      "Bitte anmelden.",
      401,
    );
    return NextResponse.json(db.select().from(doctors).all().map(doctorDto));
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
    requireValue(isAssigner(user.role), "Keine Berechtigung.", 403);
    const body = await readBody(request);
    validateFields(body);
    requireValue(typeof body.name === "string", "Bitte Namen angeben.");
    const dates = body.unavailableDates ?? [];
    requireValue(
      Array.isArray(dates) && dates.every(isDateKey),
      "Ungültige Sperrtage.",
    );
    const doctor = db.transaction((tx) => {
      const created = tx
        .insert(doctors)
        .values({ name: body.name.trim(), color: body.color })
        .returning()
        .get()!;
      const uniqueDates = [...new Set<string>(dates)];
      if (uniqueDates.length)
        tx.insert(unavailableDates)
          .values(uniqueDates.map((date) => ({ doctorId: created.id, date })))
          .run();
      return created;
    });
    return NextResponse.json(doctorDto(doctor), { status: 201 });
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
    requireValue(isAssigner(user.role), "Keine Berechtigung.", 403);
    const body = await readBody(request);
    validateFields(body);
    requireValue(Number.isInteger(body.id) && body.id > 0, "Ungültiger Arzt.");
    const values: Partial<NewDoctor> = {};
    for (const key of [
      "name",
      "color",
      "unavailableShiftTypes",
      "disabled",
      "oa",
    ] as const) {
      if (body[key] !== undefined)
        Object.assign(values, {
          [key]: key === "name" ? body[key].trim() : body[key],
        });
    }
    requireValue(Object.keys(values).length > 0, "Keine Änderung angegeben.");
    const updated = db
      .update(doctors)
      .set(values)
      .where(eq(doctors.id, body.id))
      .returning()
      .get();
    requireValue(updated, "Arzt nicht gefunden.", 404);
    return NextResponse.json(doctorDto(updated));
  } catch (error) {
    return apiError(error);
  }
}
