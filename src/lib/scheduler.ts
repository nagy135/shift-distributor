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
export type GenerationMode = "replace" | "fill-empty";
interface GenerateAssignmentsParams {
  dates: Date[];
  doctors: Doctor[];
  shiftTypes?: readonly ShiftType[];
  unavailableDatesByDoctor?: Record<number, Set<string>>;
  vacationDoctorIdsByDate?: Record<string, readonly number[]>;
  existingShifts?: Shift[];
  random?: () => number;
  mode?: GenerationMode;
}

export function generateAssignmentsForMonth({
  dates,
  doctors,
  shiftTypes = SHIFT_TYPES,
  unavailableDatesByDoctor,
  vacationDoctorIdsByDate,
  existingShifts = [],
  random = Math.random,
  mode = "replace",
}: GenerateAssignmentsParams): GeneratedAssignment[] {
  const assignments: GeneratedAssignment[] = [];
  const targetDates = new Set(dates.map(dateKey));
  const plannedShifts = new Map<
    string,
    Pick<Shift, "date" | "shiftType" | "doctorIds">
  >(existingShifts.map((shift) => [`${shift.date}|${shift.shiftType}`, shift]));
  let counts = new Map<number, number>();
  for (const shift of existingShifts.filter((shift) =>
    targetDates.has(shift.date),
  ))
    for (const id of shift.doctorIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const date of [...dates].sort((a, b) => a.getTime() - b.getTime())) {
    const key = dateKey(date);
    for (const shiftType of shiftTypes) {
      if (!isScheduledDutyDay(key, shiftType)) continue;
      const assignmentKey = `${key}|${shiftType}`;
      const existingShift = plannedShifts.get(assignmentKey);
      if (mode === "fill-empty" && (existingShift?.doctorIds.length ?? 0) > 0)
        continue;
      // Keep every other assignment until it has a populated replacement.
      const contextShifts = [...plannedShifts.values()].filter(
        (shift) => shift.date !== key || shift.shiftType !== shiftType,
      );
      const nextCounts = new Map(counts);
      for (const id of existingShift?.doctorIds ?? [])
        nextCounts.set(id, (nextCounts.get(id) ?? 0) - 1);
      const eligible = doctors.filter(
        (doctor) =>
          isDoctorEligible(doctor, shiftType) &&
          getAssignmentConflicts(doctor, key, shiftType, {
            shifts: contextShifts,
            unavailableByDoctor: unavailableDatesByDoctor,
            vacationDoctorIdsByDate,
          }).length === 0 &&
          !contextShifts.some(
            (shift) =>
              shift.date === key && shift.doctorIds.includes(doctor.id),
          ),
      );
      const ranked = eligible
        .map((doctor) => ({ doctor, tie: random() }))
        .sort(
          (a, b) =>
            (nextCounts.get(a.doctor.id) ?? 0) -
              (nextCounts.get(b.doctor.id) ?? 0) || a.tie - b.tie,
        );
      const previous = dateKey(addDays(parseDateKey(key), -1)),
        following = dateKey(addDays(parseDateKey(key), 1));
      const requiredCount = shiftType === "20shift" && isFriday(date) ? 2 : 1;
      const doctorIds: number[] = [];
      for (let slot = 0; slot < requiredCount && ranked.length > 0; slot++) {
        const preferredIndex = ranked.findIndex(
          ({ doctor }) =>
            !contextShifts.some(
              (shift) =>
                (shift.date === previous || shift.date === following) &&
                shift.doctorIds.includes(doctor.id),
            ),
        );
        const [{ doctor }] = ranked.splice(Math.max(0, preferredIndex), 1);
        doctorIds.push(doctor.id);
        nextCounts.set(doctor.id, (nextCounts.get(doctor.id) ?? 0) + 1);
      }
      if (doctorIds.length === 0) continue;
      counts = nextCounts;
      const assignment = {
        date: key,
        shiftType,
        doctorIds,
      };
      plannedShifts.set(assignmentKey, assignment);
      if (
        existingShift?.doctorIds.length === doctorIds.length &&
        doctorIds.every((id) => existingShift.doctorIds.includes(id))
      )
        continue;
      assignments.push(assignment);
    }
  }
  return assignments;
}
