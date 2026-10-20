import { eachDayOfInterval, format } from "date-fns";
import { dateKey, parseDateKey } from "./dates";
import type { NightShift, VacationDay } from "./contracts";
import type { VacationColor } from "./vacations";

export interface CalendarDateRange {
  start: string;
  end: string;
}

export function calendarDateRange(
  anchor: string,
  end: string,
): CalendarDateRange {
  return anchor <= end ? { start: anchor, end } : { start: end, end: anchor };
}

export function datesInCalendarRange(range: CalendarDateRange): string[] {
  return eachDayOfInterval({
    start: parseDateKey(range.start),
    end: parseDateKey(range.end),
  }).map(dateKey);
}

export function formatCalendarDateRange(dates: readonly string[]): string {
  if (dates.length === 0) return "";
  const start = format(parseDateKey(dates[0]), "dd.MM.yyyy");
  return dates.length === 1
    ? start
    : `${start} – ${format(parseDateKey(dates[dates.length - 1]), "dd.MM.yyyy")} (${dates.length} Tage)`;
}

export function commonDoctorIds(
  dates: readonly string[],
  idsByDate: ReadonlyMap<string, string[]>,
): string[] {
  return (idsByDate.get(dates[0]) ?? []).filter((id) =>
    dates.every((date) => idsByDate.get(date)?.includes(id)),
  );
}

export function vacationRangeChanges(
  dates: readonly string[],
  doctorId: number,
  color: VacationColor,
  days: readonly Pick<VacationDay, "doctorId" | "date" | "color">[],
) {
  const current = new Map(
    days
      .filter((day) => day.doctorId === doctorId)
      .map((day) => [day.date, day.color]),
  );
  const remove = dates.every((date) => current.get(date) === color);
  return dates.map((date) => ({
    doctorId,
    date,
    color: remove ? null : color,
  }));
}

export function nightShiftRangeChanges(
  dates: readonly string[],
  doctorId: number,
  shiftsByDate: ReadonlyMap<string, Pick<NightShift, "doctorIds" | "version">>,
) {
  const remove = dates.every((date) =>
    shiftsByDate.get(date)?.doctorIds.includes(doctorId),
  );
  return dates.flatMap((date) => {
    const shift = shiftsByDate.get(date);
    const current = shift?.doctorIds ?? [];
    if (!remove && current.includes(doctorId)) return [];
    return [
      {
        date,
        doctorIds: remove
          ? current.filter((id) => id !== doctorId)
          : [...current, doctorId].sort((a, b) => a - b),
        expectedVersion: shift?.version ?? 0,
      },
    ];
  });
}
