export const HOLIDAY_DATES_2026 = [
  "2026-01-01",
  "2026-04-03",
  "2026-04-06",
  "2026-05-01",
  "2026-05-14",
  "2026-05-25",
  "2026-06-04",
  "2026-10-03",
  "2026-12-25",
  "2026-12-26",
] as const;

export const HOLIDAY_DATES_BY_YEAR = {
  2026: HOLIDAY_DATES_2026,
} as const;

export const HOLIDAY_DATES = Object.values(HOLIDAY_DATES_BY_YEAR).flat();

export const HOLIDAY_DATE_SET = new Set<string>(HOLIDAY_DATES);

export const HOLIDAY_DAY_SET = new Set<string>(
  HOLIDAY_DATES.map((date) => date.slice(5)),
);
