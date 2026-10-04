import type { Doctor, Shift } from "./contracts";
import { parseDateKey } from "./dates";
import { isWeekendOrHoliday } from "./holidays";
import {
  doesCalendarShiftUnavailableDateClash,
  isDayDutyShiftType,
  isShiftType,
  isWeekendOnly,
} from "./shifts";

export type ConflictReason =
  | "disabled"
  | "restricted-duty"
  | "unavailable"
  | "vacation"
  | "night-overlap"
  | "oa-only";
export interface SchedulingContext {
  shifts: Pick<Shift, "date" | "shiftType" | "doctorIds">[];
  unavailableByDoctor?: Record<number, Set<string>>;
  vacationDoctorIdsByDate?: Record<string, readonly number[]>;
}

export function isDoctorEligible(
  doctor: Doctor,
  shiftType: string,
  showOaDoctors = false,
) {
  return (
    !doctor.disabled &&
    (shiftType === "oa" ? doctor.oa : showOaDoctors || !doctor.oa)
  );
}

export function getAssignmentConflicts(
  doctor: Doctor,
  date: string,
  shiftType: string,
  context: SchedulingContext,
): ConflictReason[] {
  const reasons: ConflictReason[] = [];
  if (doctor.disabled) reasons.push("disabled");
  if (shiftType === "oa" && !doctor.oa) reasons.push("oa-only");
  if (doctor.unavailableShiftTypes.includes(shiftType))
    reasons.push("restricted-duty");
  if (
    doesCalendarShiftUnavailableDateClash(shiftType) &&
    context.unavailableByDoctor?.[doctor.id]?.has(date)
  )
    reasons.push("unavailable");
  if (context.vacationDoctorIdsByDate?.[date]?.includes(doctor.id))
    reasons.push("vacation");
  if (
    context.shifts.some(
      (shift) =>
        shift.date === date &&
        shift.doctorIds.includes(doctor.id) &&
        (shiftType === "night"
          ? isDayDutyShiftType(shift.shiftType)
          : isDayDutyShiftType(shiftType) && shift.shiftType === "night"),
    )
  )
    reasons.push("night-overlap");
  return reasons;
}

export function isScheduledDutyDay(date: string, shiftType: string) {
  return (
    !isShiftType(shiftType) ||
    !isWeekendOnly(shiftType) ||
    isWeekendOrHoliday(parseDateKey(date))
  );
}

export function indexAbsences(
  days: { doctorId?: number; date: string; approved?: boolean }[],
): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  for (const day of days) {
    if (!day.approved || day.doctorId === undefined) continue;
    const ids = (result[day.date] ??= []);
    if (!ids.includes(day.doctorId)) ids.push(day.doctorId);
  }
  return result;
}
