import type { AuthUser } from "@/lib/authz";
import { isDateKey } from "@/lib/dates";
import type { AppDatabase } from "@/lib/db";
import { doctors, shifts } from "@/lib/db/schema";
import { canAssignCalendarShiftType } from "@/lib/roles";
import { ALL_CALENDAR_SHIFT_TYPES } from "@/lib/shifts";
import { and, eq, inArray, sql } from "drizzle-orm";
import { InputError, requireValue } from "./errors";

export interface AssignmentInput {
  date: string;
  shiftType: string;
  doctorIds: number[];
  expectedVersion?: number;
}

export function saveAssignments(
  database: AppDatabase,
  user: AuthUser,
  inputs: AssignmentInput[],
  allowSecretaryNight = false,
) {
  requireValue(
    Array.isArray(inputs) && inputs.length > 0 && inputs.length <= 1000,
    "Bitte Dienste angeben.",
  );
  const keys = new Set<string>();
  for (const input of inputs) {
    requireValue(input && isDateKey(input.date), "Ungültiges Dienstdatum.");
    requireValue(
      ALL_CALENDAR_SHIFT_TYPES.includes(input.shiftType),
      "Unbekannter Dienst.",
    );
    requireValue(
      canAssignCalendarShiftType(user.role, input.shiftType) ||
        (allowSecretaryNight &&
          user.role === "secretary" &&
          input.shiftType === "night"),
      "Keine Berechtigung.",
      403,
    );
    requireValue(
      Array.isArray(input.doctorIds) &&
        input.doctorIds.every((id) => Number.isInteger(id) && id > 0),
      "Ungültige Arztauswahl.",
    );
    requireValue(
      input.expectedVersion === undefined ||
        (Number.isInteger(input.expectedVersion) && input.expectedVersion >= 0),
      "Ungültige Dienstversion.",
    );
    const key = `${input.date}|${input.shiftType}`;
    requireValue(
      !keys.has(key),
      "Ein Dienst darf nur einmal je Anfrage geändert werden.",
    );
    keys.add(key);
  }
  return database.transaction((tx) => {
    const ids = [...new Set(inputs.flatMap((input) => input.doctorIds))];
    if (ids.length)
      requireValue(
        tx
          .select({ id: doctors.id })
          .from(doctors)
          .where(inArray(doctors.id, ids))
          .all().length === ids.length,
        "Ein ausgewählter Arzt existiert nicht mehr.",
      );
    return inputs.map((input) => {
      const existing = tx
        .select()
        .from(shifts)
        .where(
          and(
            eq(shifts.date, input.date),
            eq(shifts.shiftType, input.shiftType),
          ),
        )
        .get();
      if (
        input.expectedVersion !== undefined &&
        input.expectedVersion !== (existing?.version ?? 0)
      )
        throw new InputError(
          "Dieser Dienst wurde inzwischen geändert. Bitte erneut auswählen.",
          409,
          "STALE_ASSIGNMENT",
        );
      const doctorIds = [...new Set(input.doctorIds)];
      return existing
        ? tx
            .update(shifts)
            .set({ doctorIds, version: sql`${shifts.version} + 1` })
            .where(eq(shifts.id, existing.id))
            .returning()
            .get()!
        : tx
            .insert(shifts)
            .values({ date: input.date, shiftType: input.shiftType, doctorIds })
            .returning()
            .get()!;
    });
  });
}
