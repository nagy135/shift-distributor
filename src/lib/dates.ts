import {
  addDays,
  endOfMonth,
  endOfYear,
  format,
  startOfISOWeek,
  startOfMonth,
  startOfYear,
} from "date-fns";

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    Number(value.slice(0, 4)) >= 1970
  );
}

export function isValidMonthKey(value: string): boolean {
  return (
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 1970
  );
}

export function parseYear(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const year = Number(value);
  return Number.isInteger(year) && year >= 1970 && year <= 9999 ? year : null;
}

export const parseDateKey = (value: string): Date =>
  new Date(`${value}T12:00:00`);
export const dateKey = (date: Date): string => format(date, "yyyy-MM-dd");
export const yearRange = (year: number) => ({
  start: `${year}-01-01`,
  end: `${year}-12-31`,
});

// Two preceding ISO weeks are needed to calculate consecutive night-duty rest days.
export function schedulingRange(
  date: Date,
  period: "month" | "year" = "month",
) {
  const start = period === "year" ? startOfYear(date) : startOfMonth(date);
  const end = period === "year" ? endOfYear(date) : endOfMonth(date);
  return {
    start: dateKey(addDays(startOfISOWeek(start), -14)),
    end: dateKey(addDays(end, 11)),
  };
}
