import type { AuthUser } from "@/lib/authz";
import { isDateKey, yearRange } from "@/lib/dates";
import type { AppDatabase } from "@/lib/db";
import { doctors, notifications, users, vacationDays } from "@/lib/db/schema";
import { isAssigner } from "@/lib/roles";
import {
  VACATION_COLORS,
  VACATION_DAYS_PER_YEAR,
  type VacationColor,
} from "@/lib/vacations";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { InputError, requireValue } from "./errors";

export interface VacationEdit {
  doctorId: number;
  date: string;
  color: VacationColor | null;
}

export function editVacations(
  database: AppDatabase,
  user: AuthUser,
  changes: VacationEdit[],
) {
  requireValue(
    Array.isArray(changes) && changes.length > 0 && changes.length <= 1000,
    "Bitte Urlaubstage angeben.",
  );
  const keys = new Set<string>();
  for (const change of changes) {
    requireValue(
      change &&
        Number.isInteger(change.doctorId) &&
        change.doctorId > 0 &&
        isDateKey(change.date),
      "Ungültiger Urlaubstag.",
    );
    requireValue(
      isAssigner(user.role) ||
        (user.role === "doctor" && user.doctorId === change.doctorId),
      "Keine Berechtigung.",
      403,
    );
    requireValue(
      change.color === null || VACATION_COLORS.includes(change.color),
      "Ungültige Urlaubsart.",
    );
    const key = `${change.doctorId}|${change.date}`;
    requireValue(
      !keys.has(key),
      "Ein Urlaubstag darf nur einmal geändert werden.",
    );
    keys.add(key);
  }
  return database.transaction((tx) => {
    const doctorIds = [...new Set(changes.map((change) => change.doctorId))];
    requireValue(
      tx
        .select({ id: doctors.id })
        .from(doctors)
        .where(inArray(doctors.id, doctorIds))
        .all().length === doctorIds.length,
      "Arzt nicht gefunden.",
    );
    const periods = new Set(
      changes.map((change) => `${change.doctorId}|${change.date.slice(0, 4)}`),
    );
    for (const period of periods) {
      const [doctorId, year] = period.split("|").map(Number);
      const { start, end } = yearRange(year);
      const existing = tx
        .select()
        .from(vacationDays)
        .where(
          and(
            eq(vacationDays.doctorId, doctorId),
            gte(vacationDays.date, start),
            lte(vacationDays.date, end),
          ),
        )
        .all();
      const next = new Map(existing.map((day) => [day.date, day.color]));
      for (const change of changes.filter(
        (change) =>
          change.doctorId === doctorId && change.date.startsWith(`${year}-`),
      )) {
        if (change.color === null) next.delete(change.date);
        else next.set(change.date, change.color);
      }
      for (const color of VACATION_COLORS) {
        const count = [...next.values()].filter(
          (value) => value === color,
        ).length;
        const previous = existing.filter((day) => day.color === color).length;
        requireValue(
          count <= VACATION_DAYS_PER_YEAR[color] || count <= previous,
          "Das Jahreskontingent dieser Urlaubsart ist ausgeschöpft.",
        );
      }
    }
    for (const change of changes) {
      const predicate = and(
        eq(vacationDays.doctorId, change.doctorId),
        eq(vacationDays.date, change.date),
      );
      const existing = tx.select().from(vacationDays).where(predicate).get();
      if (change.color === null) {
        tx.delete(vacationDays).where(predicate).run();
        continue;
      }
      if (existing?.color === change.color) continue;
      // Every new request or change of category needs a fresh secretary decision.
      if (existing)
        tx.update(vacationDays)
          .set({ color: change.color, approved: false })
          .where(predicate)
          .run();
      else
        tx.insert(vacationDays)
          .values({
            doctorId: change.doctorId,
            date: change.date,
            color: change.color,
            approved: false,
          })
          .run();
    }
    return { success: true };
  });
}

export function decideVacation(
  database: AppDatabase,
  user: AuthUser,
  id: number,
  decision: boolean | "deny",
  expectedColor?: string,
) {
  requireValue(user.role === "secretary", "Keine Berechtigung.", 403);
  requireValue(Number.isInteger(id) && id > 0, "Ungültiger Urlaubstag.");
  requireValue(
    expectedColor === undefined ||
      VACATION_COLORS.includes(expectedColor as VacationColor),
    "Ungültige Urlaubsart.",
  );
  return database.transaction((tx) => {
    const existing = tx
      .select()
      .from(vacationDays)
      .where(eq(vacationDays.id, id))
      .get();
    if (!existing && decision === "deny") return { success: true };
    requireValue(existing, "Urlaubstag nicht gefunden.", 404);
    if (expectedColor !== undefined && existing.color !== expectedColor)
      throw new InputError(
        "Dieser Urlaub wurde inzwischen geändert. Bitte erneut auswählen.",
        409,
        "STALE_VACATION",
      );
    if (decision === "deny")
      tx.delete(vacationDays).where(eq(vacationDays.id, id)).run();
    else
      tx.update(vacationDays)
        .set({ approved: decision })
        .where(eq(vacationDays.id, id))
        .run();
    if (decision === "deny" || (decision && !existing.approved)) {
      const message = `Ihr Urlaub am ${existing.date} wurde ${decision === "deny" ? "abgelehnt" : "genehmigt"}.`;
      const recipients = tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.doctorId, existing.doctorId))
        .all();
      if (recipients.length)
        tx.insert(notifications)
          .values(
            recipients.map((recipient) => ({ userId: recipient.id, message })),
          )
          .run();
    }
    return { success: true };
  });
}
