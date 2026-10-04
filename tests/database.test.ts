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
test("invalid vacation batches and quota violations leave every existing day untouched", () => {
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
    editVacations(
      db,
      actor,
      Array.from({ length: 11 }, (_, i) => ({
        doctorId: doctor.id,
        date: `2026-11-${String(i + 1).padStart(2, "0")}`,
        color: "red",
      })),
    ),
  );
  assert.equal(db.select().from(vacationDays).all().length, 1);
  sqlite.close();
});
