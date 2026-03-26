import {
  addDays,
  differenceInCalendarDays,
  format,
  getISODay,
  parseISO,
  startOfISOWeek,
} from "date-fns";
import type { Doctor, Shift, VacationDay } from "@/lib/api";
import { AUTO_GENERATED_VACATION_COLOR, type DisplayVacationColor } from "@/lib/vacations";

export const NIGHT_FREE_COLUMN_ID = "night-free";

export type VacationDisplayDay = Omit<VacationDay, "color"> & {
  color: DisplayVacationColor;
  isAutomatic?: boolean;
};

type NightShiftWeek = {
  weekStart: Date;
  isoDays: Set<number>;
  doctorName: string;
};

const MONDAY_TO_THURSDAY = [1, 2, 3, 4] as const;
const FRIDAY_TO_SUNDAY = [5, 6, 7] as const;

const hasAllIsoDays = (week: NightShiftWeek, days: readonly number[]) =>
  days.every((day) => week.isoDays.has(day));

const getDoctorName = (
  shift: Shift,
  doctorId: number,
  doctorNameById?: ReadonlyMap<number, string>,
) => {
  const fromShift = shift.doctors.find((doctor) => doctor.id === doctorId)?.name;

  return fromShift ?? doctorNameById?.get(doctorId) ?? `Arzt #${doctorId}`;
};

const addAutomaticVacationRange = (
  target: Map<string, VacationDisplayDay>,
  doctorId: number,
  doctorName: string,
  start: Date,
  offsets: readonly number[],
) => {
  offsets.forEach((offset) => {
    const date = format(addDays(start, offset), "yyyy-MM-dd");
    target.set(`${doctorId}:${date}`, {
      doctorId,
      doctorName,
      date,
      color: AUTO_GENERATED_VACATION_COLOR,
      approved: true,
      isAutomatic: true,
    });
  });
};

const addConsecutiveBlockBonus = (
  weeks: NightShiftWeek[],
  reward: (weekStart: Date) => readonly number[],
  target: Map<string, VacationDisplayDay>,
  doctorId: number,
) => {
  let streakLength = 0;
  let previousWeekStart: Date | null = null;

  weeks.forEach((week) => {
    if (
      previousWeekStart &&
      differenceInCalendarDays(week.weekStart, previousWeekStart) === 7
    ) {
      streakLength += 1;
    } else {
      streakLength = 1;
    }

    if (streakLength >= 2) {
      addAutomaticVacationRange(
        target,
        doctorId,
        week.doctorName,
        week.weekStart,
        reward(week.weekStart),
      );
    }

    previousWeekStart = week.weekStart;
  });
};

export function getAutomaticNightShiftVacationDays(
  shifts: Shift[],
  doctors: Doctor[] = [],
): VacationDisplayDay[] {
  const doctorNameById = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));
  const nightShifts = shifts.filter((shift) => shift.shiftType === "night");
  const weeksByDoctor = new Map<number, Map<string, NightShiftWeek>>();

  nightShifts.forEach((shift) => {
    const shiftDate = parseISO(shift.date);
    const weekStart = startOfISOWeek(shiftDate);
    const weekKey = format(weekStart, "yyyy-MM-dd");
    const isoDay = getISODay(shiftDate);

    shift.doctorIds.forEach((doctorId) => {
      const doctorWeeks = weeksByDoctor.get(doctorId) ?? new Map<string, NightShiftWeek>();
      const existingWeek = doctorWeeks.get(weekKey);

      if (existingWeek) {
        existingWeek.isoDays.add(isoDay);
        doctorWeeks.set(weekKey, existingWeek);
      } else {
        doctorWeeks.set(weekKey, {
          weekStart,
          isoDays: new Set([isoDay]),
          doctorName: getDoctorName(shift, doctorId, doctorNameById),
        });
      }

      weeksByDoctor.set(doctorId, doctorWeeks);
    });
  });

  const automaticVacations = new Map<string, VacationDisplayDay>();

  weeksByDoctor.forEach((doctorWeeks, doctorId) => {
    const orderedWeeks = Array.from(doctorWeeks.values()).sort(
      (left, right) => left.weekStart.getTime() - right.weekStart.getTime(),
    );
    const mondayThursdayWeeks = orderedWeeks.filter((week) =>
      hasAllIsoDays(week, MONDAY_TO_THURSDAY),
    );
    const fridaySundayWeeks = orderedWeeks.filter((week) =>
      hasAllIsoDays(week, FRIDAY_TO_SUNDAY),
    );

    mondayThursdayWeeks.forEach((week) => {
      addAutomaticVacationRange(
        automaticVacations,
        doctorId,
        week.doctorName,
        week.weekStart,
        [4, 5, 6],
      );
    });

    fridaySundayWeeks.forEach((week) => {
      addAutomaticVacationRange(
        automaticVacations,
        doctorId,
        week.doctorName,
        week.weekStart,
        [7, 8, 9, 10],
      );
    });

    addConsecutiveBlockBonus(
      mondayThursdayWeeks,
      () => [7, 8, 9, 10],
      automaticVacations,
      doctorId,
    );
    addConsecutiveBlockBonus(
      fridaySundayWeeks,
      () => [7, 8, 9, 10, 11],
      automaticVacations,
      doctorId,
    );
  });

  return Array.from(automaticVacations.values()).sort((left, right) => {
    const dateComparison = left.date.localeCompare(right.date);

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return (left.doctorId ?? 0) - (right.doctorId ?? 0);
  });
}

export function getDoctorNamesByDate(days: readonly VacationDisplayDay[]) {
  const next: Record<string, string[]> = {};

  days.forEach((day) => {
    const doctorName = day.doctorName ?? `Arzt #${day.doctorId ?? "?"}`;
    const current = next[day.date] ?? [];

    if (!current.includes(doctorName)) {
      current.push(doctorName);
    }

    next[day.date] = current.sort((left, right) => left.localeCompare(right, "de"));
  });

  return next;
}
