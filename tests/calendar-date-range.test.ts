import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarDateRange,
  commonDoctorIds,
  datesInCalendarRange,
  nightShiftRangeChanges,
  vacationRangeChanges,
} from "../src/lib/calendar-date-range";

test("drag ranges include every date across rows, months and DST in either direction", () => {
  const expected = [
    "2026-03-27",
    "2026-03-28",
    "2026-03-29",
    "2026-03-30",
    "2026-03-31",
    "2026-04-01",
  ];
  assert.deepEqual(
    datesInCalendarRange(calendarDateRange(expected[0], expected[5])),
    expected,
  );
  assert.deepEqual(
    datesInCalendarRange(calendarDateRange(expected[5], expected[0])),
    expected,
  );
  assert.deepEqual(
    datesInCalendarRange(calendarDateRange("2024-02-28", "2024-03-01")),
    ["2024-02-28", "2024-02-29", "2024-03-01"],
  );
  assert.deepEqual(
    datesInCalendarRange(calendarDateRange("2026-01-05", "2026-01-05")),
    ["2026-01-05"],
  );
  assert.deepEqual(
    datesInCalendarRange(calendarDateRange("2026-01-05", "2026-01-07")),
    ["2026-01-05", "2026-01-06", "2026-01-07"],
  );
});

test("vacation ranges fill mixed selections and remove only a fully selected range", () => {
  const dates = ["2026-01-05", "2026-01-06", "2026-01-07"];
  const days = [
    { doctorId: 1, date: dates[0], color: "red" as const },
    { doctorId: 1, date: dates[1], color: "blue" as const },
    { doctorId: 2, date: dates[2], color: "red" as const },
  ];
  assert.deepEqual(
    vacationRangeChanges(dates, 1, "red", days),
    dates.map((date) => ({ doctorId: 1, date, color: "red" })),
  );
  assert.deepEqual(
    vacationRangeChanges(
      dates,
      1,
      "red",
      dates.map((date) => ({ doctorId: 1, date, color: "red" })),
    ),
    dates.map((date) => ({ doctorId: 1, date, color: null })),
  );
});

test("night ranges preserve co-assignees and versions without toggling mixed dates off", () => {
  const dates = ["2026-01-05", "2026-01-06", "2026-01-07"];
  const shifts = new Map([
    [dates[0], { doctorIds: [1, 2], version: 4 }],
    [dates[1], { doctorIds: [2], version: 3 }],
  ]);
  assert.deepEqual(nightShiftRangeChanges(dates, 1, shifts), [
    { date: dates[1], doctorIds: [1, 2], expectedVersion: 3 },
    { date: dates[2], doctorIds: [1], expectedVersion: 0 },
  ]);
  shifts.set(dates[1], { doctorIds: [1, 2], version: 4 });
  shifts.set(dates[2], { doctorIds: [1], version: 1 });
  assert.deepEqual(nightShiftRangeChanges(dates, 1, shifts), [
    { date: dates[0], doctorIds: [2], expectedVersion: 4 },
    { date: dates[1], doctorIds: [2], expectedVersion: 4 },
    { date: dates[2], doctorIds: [], expectedVersion: 1 },
  ]);
});

test("range picker marks a doctor selected only when assigned to every date", () => {
  const ids = new Map([
    ["2026-01-05", ["1", "2"]],
    ["2026-01-06", ["2", "3"]],
  ]);
  assert.deepEqual(commonDoctorIds(["2026-01-05", "2026-01-06"], ids), ["2"]);
  assert.deepEqual(commonDoctorIds(["2026-01-05", "2026-01-07"], ids), []);
  assert.deepEqual(commonDoctorIds([], ids), []);
});
