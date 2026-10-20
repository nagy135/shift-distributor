import { addDays, isFriday } from "date-fns";
import type { Doctor, Shift } from "./contracts";
import { dateKey, parseDateKey } from "./dates";
import {
  getAssignmentConflicts,
  isDoctorEligible,
  isScheduledDutyDay,
} from "./scheduling-rules";
import { SHIFT_TYPES, type ShiftType } from "./shifts";

export interface GeneratedAssignment {
  date: string;
  shiftType: ShiftType;
  doctorIds: number[];
}
interface GenerateAssignmentsParams {
  dates: Date[];
  doctors: Doctor[];
  shiftTypes?: readonly ShiftType[];
  unavailableDatesByDoctor?: Record<number, Set<string>>;
  vacationDoctorIdsByDate?: Record<string, readonly number[]>;
  existingShifts?: Shift[];
  random?: () => number;
}

export function generateAssignmentsForMonth({
  dates,
  doctors,
  shiftTypes = SHIFT_TYPES,
  unavailableDatesByDoctor,
  vacationDoctorIdsByDate,
  existingShifts = [],
  random = Math.random,
}: GenerateAssignmentsParams): GeneratedAssignment[] {
  const assignments: GeneratedAssignment[] = [];
  const targetDates = new Set(dates.map(dateKey));
  const contextShifts = existingShifts.filter(
    (shift) =>
      !targetDates.has(shift.date) ||
      !shiftTypes.includes(shift.shiftType as ShiftType),
  );
  const counts = new Map<number, number>();
  for (const shift of contextShifts.filter((shift) =>
    targetDates.has(shift.date),
  ))
    for (const id of shift.doctorIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const date of [...dates].sort((a, b) => a.getTime() - b.getTime())) {
    const key = dateKey(date);
    for (const shiftType of shiftTypes) {
      if (!isScheduledDutyDay(key, shiftType)) {
        assignments.push({ date: key, shiftType, doctorIds: [] });
        continue;
      }
      const eligible = doctors.filter(
        (doctor) =>
          isDoctorEligible(doctor, shiftType) &&
          getAssignmentConflicts(doctor, key, shiftType, {
            shifts: [...contextShifts, ...assignments],
            unavailableByDoctor: unavailableDatesByDoctor,
            vacationDoctorIdsByDate,
          }).length === 0 &&
          ![...contextShifts, ...assignments].some(
            (shift) =>
              shift.date === key && shift.doctorIds.includes(doctor.id),
          ),
      );
      const ranked = eligible
        .map((doctor) => ({ doctor, tie: random() }))
        .sort(
          (a, b) =>
            (counts.get(a.doctor.id) ?? 0) - (counts.get(b.doctor.id) ?? 0) ||
            a.tie - b.tie,
        );
      const previous = dateKey(addDays(parseDateKey(key), -1)),
        following = dateKey(addDays(parseDateKey(key), 1));
      const requiredCount = shiftType === "20shift" && isFriday(date) ? 2 : 1;
      const doctorIds: number[] = [];
      for (let slot = 0; slot < requiredCount && ranked.length > 0; slot++) {
        const preferredIndex = ranked.findIndex(
          ({ doctor }) =>
            ![...contextShifts, ...assignments].some(
              (shift) =>
                (shift.date === previous || shift.date === following) &&
                shift.doctorIds.includes(doctor.id),
            ),
        );
        const [{ doctor }] = ranked.splice(Math.max(0, preferredIndex), 1);
        doctorIds.push(doctor.id);
        counts.set(doctor.id, (counts.get(doctor.id) ?? 0) + 1);
      }
      assignments.push({
        date: key,
        shiftType,
        doctorIds,
      });
    }
  }
  return assignments;
}
