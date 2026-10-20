import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import type { AuthUser } from "../src/lib/authz";
import { openDatabase } from "../src/lib/db";
import {
  doctors,
  notifications,
  shifts,
  users,
  vacationDays,
} from "../src/lib/db/schema";
import { saveAssignments } from "../src/lib/server/assignment-service";
import {
  decideVacation,
  editVacations,
} from "../src/lib/server/vacation-service";
import { getVacationQuotaIssues } from "../src/lib/vacations";
import { generateAssignmentsForMonth } from "../src/lib/scheduler";
import { parseDateKey } from "../src/lib/dates";
import { AUTO_DISTRIBUTE_SHIFT_TYPES } from "../src/lib/shifts";

const require = createRequire(import.meta.url);
const { migrateDatabase } = require("../scripts/migrate.cjs") as {
  migrateDatabase: (
    sqlite: Database.Database,
    folder?: string,
    until?: number,
  ) => void;
};
function fixture() {
  const { sqlite, db } = openDatabase(":memory:");
  migrateDatabase(sqlite);
  const doctor = db
    .insert(doctors)
    .values({ name: "Test doctor" })
    .returning()
    .get()!;
  const user = db
    .insert(users)
    .values({
      email: "test@example.invalid",
      passwordHash: "unused",
      role: "doctor",
      doctorId: doctor.id,
    })
    .returning()
    .get()!;
  const actor: AuthUser = {
    id: user.id,
    email: user.email,
    doctorId: doctor.id,
    role: "shift_assigner",
    admin: false,
  };
  return { sqlite, db, doctor, actor };
}
test("fresh migrations are repeatable and enforce all unique keys", () => {
  const { db, sqlite, doctor } = fixture();
  migrateDatabase(sqlite);
  assert.deepEqual(sqlite.pragma("foreign_key_check"), []);
  assert.equal(sqlite.pragma("integrity_check", { simple: true }), "ok");
  db.insert(vacationDays)
    .values({
      doctorId: doctor.id,
      date: "2026-10-05",
      color: "red",
      approved: false,
    })
    .run();
  assert.throws(() =>
    db
      .insert(vacationDays)
      .values({
        doctorId: doctor.id,
        date: "2026-10-05",
        color: "red",
        approved: false,
      })
      .run(),
  );
  sqlite.close();
});
test("legacy JSON and renamed slots merge without dropping assignments or history", () => {
  const { sqlite, db } = openDatabase(":memory:");
  migrateDatabase(sqlite, undefined, 1773525909805);
  sqlite.exec(`INSERT INTO doctors(id,name,unavailable_shift_types) VALUES (1,'Test','"[\\"night\\"]"'),(2,'Other','[]');
    INSERT INTO shifts(date,shift_type,doctor_ids) VALUES ('2026-01-01','ND','[1]'),('2026-01-01','night','[2]'),('2026-01-02','INT-1','[1]');`);
  const history = sqlite.prepare("SELECT * FROM __drizzle_migrations").all();
  migrateDatabase(sqlite);
  assert.deepEqual(
    db.select().from(doctors).where(eq(doctors.id, 1)).get()!
      .unavailableShiftTypes,
    ["night"],
  );
  const merged = db
    .select()
    .from(shifts)
    .where(eq(shifts.shiftType, "night"))
    .get()!;
  assert.deepEqual(new Set(merged.doctorIds), new Set([1, 2]));
  assert(
    db
      .select()
      .from(shifts)
      .all()
      .some((shift) => shift.shiftType === "ITS-1"),
  );
  assert.deepEqual(
    sqlite
      .prepare("SELECT * FROM __drizzle_migrations ORDER BY id LIMIT ?")
      .all(history.length),
    history,
  );
  sqlite.close();
});
test("batch assignment validates before writing and rejects duplicate slots and stale versions", () => {
  const { db, sqlite, doctor, actor } = fixture();
  const input = {
    date: "2026-10-05",
    shiftType: "20shift",
    doctorIds: [doctor.id],
    expectedVersion: 0,
  };
  assert.throws(() =>
    saveAssignments(db, actor, [
      input,
      { ...input, date: "2026-10-06", doctorIds: [999] },
    ]),
  );
  assert.equal(db.select().from(shifts).all().length, 0);
  assert.throws(() => saveAssignments(db, actor, [input, input]));
  saveAssignments(db, actor, [input]);
  assert.throws(() => saveAssignments(db, actor, [input]));
  assert.equal(db.select().from(shifts).get()!.version, 1);
  saveAssignments(db, actor, [{ ...input, expectedVersion: 1 }]);
  assert.equal(db.select().from(shifts).get()!.version, 2);
  sqlite.close();
});
test("SQLite failures roll back the complete assignment batch", () => {
  const { db, sqlite, doctor, actor } = fixture();
  sqlite.exec(
    "CREATE TRIGGER fail_second BEFORE INSERT ON shifts WHEN NEW.date='2026-10-06' BEGIN SELECT RAISE(ABORT, 'injected failure'); END;",
  );
  assert.throws(() =>
    saveAssignments(
      db,
      actor,
      ["2026-10-05", "2026-10-06"].map((date) => ({
        date,
        shiftType: "20shift",
        doctorIds: [doctor.id],
      })),
    ),
  );
  assert.equal(db.select().from(shifts).all().length, 0);
  sqlite.close();
});
test("generation updates only populated changes and preserves skipped assignment versions", () => {
  const { db, sqlite, doctor, actor } = fixture();
  const second = db
    .insert(doctors)
    .values({ name: "Second" })
    .returning()
    .get()!;
  const third = db.insert(doctors).values({ name: "Third" }).returning().get()!;
  db.insert(shifts)
    .values([
      {
        date: "2026-10-05",
        shiftType: "17shift",
        doctorIds: [doctor.id],
        version: 7,
      },
      {
        date: "2026-10-05",
        shiftType: "night",
        doctorIds: [third.id],
        version: 4,
      },
      {
        date: "2026-10-05",
        shiftType: "20shift",
        doctorIds: [doctor.id],
        version: 2,
      },
      {
        date: "2026-10-06",
        shiftType: "20shift",
        doctorIds: [third.id],
        version: 6,
      },
    ])
    .run();
  const before = db.select().from(shifts).all();
  const generated = generateAssignmentsForMonth({
    dates: [parseDateKey("2026-10-05"), parseDateKey("2026-10-06")],
    doctors: [doctor, second, third].map((d) => ({ ...d, createdAt: null })),
    existingShifts: before.map((s) => ({ ...s, doctors: [] })),
    shiftTypes: AUTO_DISTRIBUTE_SHIFT_TYPES,
    unavailableDatesByDoctor: Object.fromEntries(
      [doctor, second, third].map((d) => [d.id, new Set(["2026-10-06"])]),
    ),
    random: () => 0.5,
  });
  assert.deepEqual(generated, [
    { date: "2026-10-05", shiftType: "20shift", doctorIds: [second.id] },
  ]);
  saveAssignments(
    db,
    actor,
    generated.map((assignment) => ({ ...assignment, expectedVersion: 2 })),
  );
  const after = db.select().from(shifts).all();
  for (const previous of before) {
    const saved = after.find((s) => s.id === previous.id)!;
    if (previous.date === "2026-10-05" && previous.shiftType === "20shift") {
      assert.deepEqual(saved.doctorIds, [second.id]);
      assert.equal(saved.version, 3);
    } else assert.deepEqual(saved, previous);
  }
  sqlite.close();
});
test("fill-empty generation leaves occupied slots untouched when saving the missing cell", () => {
  const { db, sqlite, doctor, actor } = fixture();
  const second = db
    .insert(doctors)
    .values({ name: "Second" })
    .returning()
    .get()!;
  db.insert(shifts)
    .values([
      {
        date: "2026-10-05",
        shiftType: "20shift",
        doctorIds: [doctor.id],
        version: 5,
      },
      { date: "2026-10-06", shiftType: "20shift", doctorIds: [], version: 3 },
    ])
    .run();
  const before = db.select().from(shifts).all();
  const generated = generateAssignmentsForMonth({
    dates: [parseDateKey("2026-10-05"), parseDateKey("2026-10-06")],
    doctors: [doctor, second].map((d) => ({ ...d, createdAt: null })),
    existingShifts: before.map((s) => ({ ...s, doctors: [] })),
    shiftTypes: AUTO_DISTRIBUTE_SHIFT_TYPES,
    mode: "fill-empty",
    random: () => 0.5,
  });
  assert.deepEqual(generated, [
    { date: "2026-10-06", shiftType: "20shift", doctorIds: [second.id] },
  ]);
  saveAssignments(
    db,
    actor,
    generated.map((assignment) => ({ ...assignment, expectedVersion: 3 })),
  );
  assert.deepEqual(
    db.select().from(shifts).where(eq(shifts.id, before[0].id)).get(),
    before[0],
  );
  const filled = db
    .select()
    .from(shifts)
    .where(eq(shifts.id, before[1].id))
    .get()!;
  assert.deepEqual(filled.doctorIds, [second.id]);
  assert.equal(filled.version, 4);
  sqlite.close();
});
test("vacation requests remain pending, preserve IDs and notify exactly once on approval", () => {
  const { db, sqlite, doctor, actor } = fixture();
  const change = {
    doctorId: doctor.id,
    date: "2026-10-05",
    color: "red" as const,
  };
  const own = { ...actor, role: "doctor" as const };
  editVacations(db, own, [change]);
  const first = db.select().from(vacationDays).get()!;
  assert.equal(first.approved, false);
  const secretary = { ...actor, role: "secretary" as const };
  decideVacation(db, secretary, first.id, true);
  decideVacation(db, secretary, first.id, true);
  assert.equal(db.select().from(notifications).all().length, 1);
  editVacations(db, own, [change]);
  assert.equal(db.select().from(vacationDays).get()!.approved, true);
  editVacations(db, own, [{ ...change, color: "yellow" }]);
  const changed = db.select().from(vacationDays).get()!;
  assert.throws(() => decideVacation(db, secretary, first.id, true, "red"));
  assert.equal(changed.id, first.id);
  assert.equal(changed.approved, false);
  assert.throws(() => decideVacation(db, own, first.id, true));
  sqlite.close();
});
test("invalid vacation batches leave every existing day untouched", () => {
  const { db, sqlite, doctor, actor } = fixture();
  editVacations(db, actor, [
    { doctorId: doctor.id, date: "2026-10-05", color: "blue" },
  ]);
  assert.throws(() =>
    editVacations(db, actor, [
      { doctorId: doctor.id, date: "2026-10-05", color: null },
      { doctorId: doctor.id, date: "2026-02-30", color: "red" },
    ]),
  );
  assert.equal(db.select().from(vacationDays).all().length, 1);
  assert.throws(() =>
    editVacations(db, actor, [
      { doctorId: doctor.id, date: "2026-10-05", color: null },
      { doctorId: 999, date: "2026-10-06", color: "red" },
    ]),
  );
  assert.equal(db.select().from(vacationDays).all().length, 1);
  sqlite.close();
});
test("planners and doctors can save beyond every vacation quota and correct the warnings", () => {
  for (const role of [
    "shift_assigner",
    "department_assigner",
    "doctor",
  ] as const) {
    const { db, sqlite, doctor, actor } = fixture();
    const user = { ...actor, role };
    for (const [color, month, count] of [
      ["red", "01", 11],
      ["orange", "02", 6],
      ["yellow", "03", 16],
    ] as const) {
      editVacations(
        db,
        user,
        Array.from({ length: count }, (_, index) => ({
          doctorId: doctor.id,
          date: `2026-${month}-${String(index + 1).padStart(2, "0")}`,
          color,
        })),
      );
    }
    const saved = db.select().from(vacationDays).all();
    assert.equal(saved.length, 33);
    assert(saved.every((day) => !day.approved));
    assert.deepEqual(getVacationQuotaIssues(saved, 2026).get(doctor.id), [
      { color: "red", used: 11, limit: 10, excess: 1 },
      { color: "orange", used: 6, limit: 5, excess: 1 },
      { color: "yellow", used: 16, limit: 15, excess: 1 },
    ]);
    editVacations(db, user, [
      { doctorId: doctor.id, date: "2026-01-11", color: "blue" },
      { doctorId: doctor.id, date: "2026-02-06", color: null },
      { doctorId: doctor.id, date: "2026-03-16", color: null },
    ]);
    assert.equal(
      getVacationQuotaIssues(db.select().from(vacationDays).all(), 2026).size,
      0,
    );
    const other = db
      .insert(doctors)
      .values({ name: "Other doctor" })
      .returning()
      .get()!;
    assert.throws(() =>
      editVacations(db, { ...actor, role: "doctor" }, [
        { doctorId: other.id, date: "2026-01-12", color: "red" },
      ]),
    );
    sqlite.close();
  }
});
