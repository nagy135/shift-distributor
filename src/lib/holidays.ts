import { addDays } from "date-fns";
import { dateKey } from "./dates";

const cache = new Map<number, ReadonlySet<string>>();

// Gregorian Easter (Meeus/Jones/Butcher); statutory holidays for the clinic in Hesse.
export function getHolidays(year: number): ReadonlySet<string> {
  const cached = cache.get(year);
  if (cached) return cached;
  const a = year % 19,
    b = Math.floor(year / 100),
    c = year % 100;
  const d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31),
    day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day, 12);
  const holidays = new Set([
    `${year}-01-01`,
    `${year}-05-01`,
    `${year}-10-03`,
    `${year}-12-25`,
    `${year}-12-26`,
    ...[-2, 1, 39, 50, 60].map((offset) => dateKey(addDays(easter, offset))),
  ]);
  cache.set(year, holidays);
  return holidays;
}
export const isHoliday = (date: Date): boolean =>
  getHolidays(date.getFullYear()).has(dateKey(date));
export const isWeekendOrHoliday = (date: Date): boolean =>
  [0, 6].includes(date.getDay()) || isHoliday(date);
