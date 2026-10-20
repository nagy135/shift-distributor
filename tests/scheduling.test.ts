import { QueryClient } from "@tanstack/react-query";
import { addDays, eachDayOfInterval, isFriday } from "date-fns";
import assert from "node:assert/strict";
import test from "node:test";
import {
  selectionReducer,
  type SelectionState,
} from "../src/components/calendar/useCalendarSelection";
import type { Doctor, Shift } from "../src/lib/contracts";
import {
  dateKey,
  isDateKey,
  isValidMonthKey,
  parseDateKey,
  schedulingRange,
} from "../src/lib/dates";
import { getHolidays } from "../src/lib/holidays";
import { getAutomaticNightShiftVacationDays } from "../src/lib/night-shift-vacations";
import {
  invalidateDoctors,
  invalidateSchedule,
  queryKeys,
} from "../src/lib/query-keys";
import { generateAssignmentsForMonth } from "../src/lib/scheduler";
import { AUTO_DISTRIBUTE_SHIFT_TYPES } from "../src/lib/shifts";
import {
  getAssignmentConflicts,
  indexAbsences,
} from "../src/lib/scheduling-rules";
import {
  buildCalendarIcs,
  foldIcsLine,
} from "../src/lib/server/calendar-email-content";

const doctor = (id: number): Doctor => ({
  id,
  name: "Same name",
  unavailableShiftTypes: [],
  disabled: false,
  oa: false,
  createdAt: null,
});
const shift = (date: string, type = "night", ids = [1]): Shift => ({
  id: 1,
  version: 1,
  date,
  shiftType: type,
  doctorIds: ids,
  doctors: ids.map((id) => ({ id, name: "Same name" })),
});

test("date validation rejects impossible dates and months", () => {
  assert.equal(isDateKey("2026-02-29"), false);
  assert.equal(isDateKey("2024-02-29"), true);
  assert.equal(isDateKey("2026-13-01"), false);
  assert.equal(isValidMonthKey("2026-99"), false);
});
test("Hessian holidays are calculated for each year", () => {
  assert(getHolidays(2026).has("2026-04-03"));
  assert(getHolidays(2027).has("2027-03-26"));
  assert(!getHolidays(2027).has("2027-04-03"));
  assert(getHolidays(2027).has("2027-05-27"));
});
test("absence and cross-view overlap checks use doctor IDs", () => {
  const vacationDoctorIdsByDate = indexAbsences([
    { date: "2026-10-05", doctorId: 1, approved: true },
    { date: "2026-10-05", doctorId: 2, approved: false },
  ]);
  assert.deepEqual(
    getAssignmentConflicts(doctor(2), "2026-10-05", "20shift", {
      shifts: [],
      vacationDoctorIdsByDate,
    }),
    [],
  );
  assert.deepEqual(
    getAssignmentConflicts(doctor(1), "2026-10-05", "20shift", {
      shifts: [],
      vacationDoctorIdsByDate,
    }),
    ["vacation"],
  );
  assert.deepEqual(
    getAssignmentConflicts(doctor(1), "2026-10-05", "night", {
      shifts: [shift("2026-10-05", "ITS-1")],
    }),
    ["night-overlap"],
  );
});
test("distribution is deterministic and respects holidays, vacations and existing night shifts", () => {
  const params = {
    dates: [parseDateKey("2026-04-03")],
    doctors: [doctor(1), doctor(2), doctor(3)],
    shiftTypes: ["17shift"] as const,
    vacationDoctorIdsByDate: { "2026-04-03": [1] },
    existingShifts: [shift("2026-04-03", "night", [2])],
    random: () => 0.5,
  };
  assert.deepEqual(generateAssignmentsForMonth(params), [
    { date: "2026-04-03", shiftType: "17shift", doctorIds: [3] },
  ]);
  assert.deepEqual(
    generateAssignmentsForMonth(params),
    generateAssignmentsForMonth(params),
  );
});
test("every Friday has two distinct late-duty doctors, including holidays", () => {
  const assignments = generateAssignmentsForMonth({
    dates: eachDayOfInterval({
      start: parseDateKey("2026-04-01"),
      end: parseDateKey("2026-04-30"),
    }),
    doctors: Array.from({ length: 10 }, (_, index) => doctor(index + 1)),
    shiftTypes: AUTO_DISTRIBUTE_SHIFT_TYPES,
    random: () => 0.5,
  });
  for (const assignment of assignments) {
    if (assignment.shiftType === "20shift") {
      assert.equal(
        assignment.doctorIds.length,
        isFriday(parseDateKey(assignment.date)) ? 2 : 1,
        assignment.date,
      );
    }
    assert.equal(
      new Set(assignment.doctorIds).size,
      assignment.doctorIds.length,
    );
  }
  assert.equal(
    assignments.find(
      (assignment) =>
        assignment.date === "2026-04-03" && assignment.shiftType === "17shift",
    )?.doctorIds.length,
    1,
  );
  assert.equal(
    assignments.find(
      (assignment) =>
        assignment.date === "2026-04-10" && assignment.shiftType === "17shift",
    )?.doctorIds.length,
    0,
  );
  for (const assignment of assignments.filter(
    (assignment) => assignment.shiftType === "17shift",
  )) {
    const lateDuty = assignments.find(
      (other) =>
        other.date === assignment.date && other.shiftType === "20shift",
    )!;
    assert(
      assignment.doctorIds.every((id) => !lateDuty.doctorIds.includes(id)),
    );
  }
});
test("both Friday slots respect eligibility, absences and existing assignments", () => {
  const doctors = Array.from({ length: 9 }, (_, index) => doctor(index + 1));
  doctors[0].disabled = true;
  doctors[1].oa = true;
  doctors[2].unavailableShiftTypes = ["20shift"];
  assert.deepEqual(
    generateAssignmentsForMonth({
      dates: [parseDateKey("2026-10-02")],
      doctors,
      shiftTypes: AUTO_DISTRIBUTE_SHIFT_TYPES,
      vacationDoctorIdsByDate: { "2026-10-02": [4] },
      unavailableDatesByDoctor: { 5: new Set(["2026-10-02"]) },
      existingShifts: [
        shift("2026-10-02", "night", [6]),
        shift("2026-10-02", "ITS-1", [7]),
      ],
      random: () => 0.5,
    }),
    [
      { date: "2026-10-02", shiftType: "20shift", doctorIds: [8, 9] },
      { date: "2026-10-02", shiftType: "17shift", doctorIds: [] },
    ],
  );
});
test("Friday selections preserve rest-day preferences and count both workloads", () => {
  assert.deepEqual(
    generateAssignmentsForMonth({
      dates: [parseDateKey("2026-10-02"), parseDateKey("2026-10-09")],
      doctors: [doctor(1), doctor(2), doctor(3), doctor(4)],
      shiftTypes: ["20shift"],
      random: () => 0.5,
    }),
    [
      { date: "2026-10-02", shiftType: "20shift", doctorIds: [1, 2] },
      { date: "2026-10-09", shiftType: "20shift", doctorIds: [3, 4] },
    ],
  );
  assert.deepEqual(
    generateAssignmentsForMonth({
      dates: [parseDateKey("2026-10-02"), parseDateKey("2026-10-03")],
      doctors: [doctor(1), doctor(2), doctor(3), doctor(4)],
      shiftTypes: ["20shift"],
      existingShifts: [shift("2026-10-01", "20shift", [1])],
      random: () => 0.5,
    }),
    [
      { date: "2026-10-02", shiftType: "20shift", doctorIds: [2, 3] },
      { date: "2026-10-03", shiftType: "20shift", doctorIds: [1] },
    ],
  );
});
test("Friday staffing shortages never duplicate doctors or override conflicts", () => {
  for (const available of [[], [doctor(1)]]) {
    assert.deepEqual(
      generateAssignmentsForMonth({
        dates: [parseDateKey("2026-10-02")],
        doctors: [...available, { ...doctor(2), disabled: true }],
        shiftTypes: ["20shift"],
        random: () => 0.5,
      }),
      [
        {
          date: "2026-10-02",
          shiftType: "20shift",
          doctorIds: available.map((d) => d.id),
        },
      ],
    );
  }
});
test("rest days cross year boundaries and preserve the consecutive-block bonus", () => {
  const dates = [
    "2025-12-19",
    "2025-12-20",
    "2025-12-21",
    "2025-12-26",
    "2025-12-27",
    "2025-12-28",
  ];
  const range = schedulingRange(new Date(2026, 0, 1), "year");
  assert(dates.every((date) => date >= range.start));
  const days = getAutomaticNightShiftVacationDays(
    dates.map((date) => shift(date)),
  );
  assert(days.some((day) => day.date === "2026-01-02" && day.doctorId === 1));
  assert.equal(dateKey(addDays(parseDateKey("2026-03-28"), 2)), "2026-03-30");
});
test("schedule and doctor changes invalidate every affected cached view", async () => {
  const client = new QueryClient();
  const keys = [
    queryKeys.shifts(),
    queryKeys.nightShifts(2026),
    queryKeys.vacations(2026),
    queryKeys.doctors,
  ];
  keys.forEach((key) => client.setQueryData(key, []));
  await invalidateSchedule(client);
  assert(client.getQueryState(queryKeys.shifts())?.isInvalidated);
  assert(client.getQueryState(queryKeys.nightShifts(2026))?.isInvalidated);
  await invalidateDoctors(client);
  assert(client.getQueryState(queryKeys.doctors)?.isInvalidated);
  assert(client.getQueryState(queryKeys.vacations(2026))?.isInvalidated);
  client.clear();
});
test("selection has one active editor and cannot change during a save", () => {
  let state: SelectionState = { targets: [], editor: null, phase: "idle" };
  state = selectionReducer(state, {
    type: "editor",
    editor: "quick",
    open: true,
  });
  state = selectionReducer(state, {
    type: "editor",
    editor: "modal",
    open: true,
  });
  assert.equal(state.editor, "modal");
  state = selectionReducer(state, { type: "saving", active: true });
  assert.equal(
    selectionReducer(state, { type: "editor", editor: "quick", open: true }),
    state,
  );
});
test("ICS folds UTF-8 by octets, escapes values and uses exclusive all-day end dates", () => {
  const text = "DESCRIPTION:" + "Ä🙂".repeat(60);
  const folded = foldIcsLine(text);
  assert(folded.split("\r\n").every((line) => Buffer.byteLength(line) <= 75));
  assert.equal(folded.replaceAll("\r\n ", ""), text);
  const ics = buildCalendarIcs({
    month: "2026-10",
    recipientEmail: "test@example.invalid",
    doctorId: 1,
    doctorName: "Ärztin, Test",
    monthlyShifts: [shift("2026-10-05")],
  });
  assert(ics.includes("DTSTART;VALUE=DATE:20261005"));
  assert(ics.includes("DTEND;VALUE=DATE:20261006"));
  assert(ics.includes("Ärztin\\, Test"));
  const shared = buildCalendarIcs({
    month: "2026-10",
    recipientEmail: "test@example.invalid",
    doctorId: 1,
    doctorName: "Same name",
    monthlyShifts: [shift("2026-10-05", "night", [1, 2])],
  });
  assert(shared.replaceAll("\r\n ", "").includes("Mit eingeteilt: Same name"));
});
