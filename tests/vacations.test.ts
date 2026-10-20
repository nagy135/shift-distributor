import assert from "node:assert/strict";
import test from "node:test";
import {
  formatVacationQuotaIssue,
  getVacationQuotaIssues,
} from "../src/lib/vacations";

const days = (doctorId: number, color: string, count: number, year = 2026) =>
  Array.from({ length: count }, (_, index) => ({
    doctorId,
    color,
    date: `${year}-01-${String(index + 1).padStart(2, "0")}`,
    approved: index % 2 === 0,
  }));

test("vacation warnings count pending and approved days per doctor, color and year", () => {
  const issues = getVacationQuotaIssues(
    [
      ...days(1, "red", 12),
      ...days(1, "orange", 6),
      ...days(1, "yellow", 15),
      ...days(2, "red", 10),
      ...days(2, "orange", 5),
      ...days(2, "yellow", 16),
      ...days(3, "red", 11, 2025),
      ...days(4, "blue", 31),
      ...days(4, "green", 31),
    ],
    2026,
  );
  assert.deepEqual(
    [...issues],
    [
      [
        1,
        [
          { color: "red", used: 12, limit: 10, excess: 2 },
          { color: "orange", used: 6, limit: 5, excess: 1 },
        ],
      ],
      [2, [{ color: "yellow", used: 16, limit: 15, excess: 1 }]],
    ],
  );
  assert.equal(getVacationQuotaIssues([], 2026).size, 0);
});

test("vacation warning descriptions show the category, count, limit and excess", () => {
  assert.equal(
    formatVacationQuotaIssue({ color: "red", used: 11, limit: 10, excess: 1 }),
    "Rot: 11 von 10 Tagen (1 Tag zu viel)",
  );
  assert.equal(
    formatVacationQuotaIssue({
      color: "yellow",
      used: 17,
      limit: 15,
      excess: 2,
    }),
    "Gelb: 17 von 15 Tagen (2 Tage zu viel)",
  );
});
