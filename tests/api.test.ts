import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { db } from "../src/lib/db";
import {
  doctors,
  shifts,
  users,
  monthPublications,
  calendarEmailDeliveries,
} from "../src/lib/db/schema";
import { signAccessToken } from "../src/lib/auth";
import * as monthly from "../src/app/api/shifts/route";
import * as annual from "../src/app/api/night-shifts/route";
import * as vacations from "../src/app/api/vacations/route";
import * as doctorRoutes from "../src/app/api/doctors/route";
import {
  previewMonthCalendarEmails,
  sendMonthCalendarEmails,
} from "../src/lib/server/month-calendar-emails";
import { eq } from "drizzle-orm";

const require = createRequire(import.meta.url);
require("../scripts/migrate.cjs").migrateDatabase(db.$client);
process.env.JWT_SECRET = "isolated-test-secret-never-used-in-production";
const doctor = db.insert(doctors).values({ name: "Test" }).returning().get()!;
const linkedUser = db
  .insert(users)
  .values({
    email: "linked@example.invalid",
    passwordHash: "unused",
    role: "doctor",
    doctorId: doctor.id,
  })
  .returning()
  .get()!;
const assigner = db
  .insert(users)
  .values({
    email: "assigner@example.invalid",
    passwordHash: "unused",
    role: "shift_assigner",
  })
  .returning()
  .get()!;
function request(path: string, user = linkedUser, body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${signAccessToken(user)}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
test("both monthly and annual endpoints hide unpublished months for doctors", async () => {
  db.insert(shifts)
    .values({ date: "2026-10-05", shiftType: "night", doctorIds: [doctor.id] })
    .run();
  db.insert(monthPublications)
    .values({ month: "2026-10", isPublished: false })
    .run();
  assert.deepEqual(
    await (await monthly.GET(request("/api/shifts?date=2026-10-05"))).json(),
    [],
  );
  assert.deepEqual(
    await (await annual.GET(request("/api/night-shifts?year=2026"))).json(),
    [],
  );
  assert.equal(
    (
      await (
        await annual.GET(request("/api/night-shifts?year=2026", assigner))
      ).json()
    ).length,
    1,
  );
  assert.equal(
    (await annual.GET(request("/api/night-shifts?year=abc"))).status,
    400,
  );
});
test("assignment API rejects invalid dates, IDs and unauthorized edits", async () => {
  for (const body of [null, []])
    assert.equal(
      (await monthly.POST(request("/api/shifts", assigner, body))).status,
      400,
    );
  assert.equal(
    (
      await monthly.POST(
        request("/api/shifts", assigner, {
          date: "2026-02-30",
          shiftType: "20shift",
          doctorIds: [doctor.id],
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await monthly.POST(
        request("/api/shifts", assigner, {
          date: "2026-10-06",
          shiftType: "20shift",
          doctorIds: [99999],
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await monthly.POST(
        request("/api/shifts", linkedUser, {
          date: "2026-10-06",
          shiftType: "20shift",
          doctorIds: [doctor.id],
        }),
      )
    ).status,
    403,
  );
});
test("doctor-created vacation entries are pending through the actual API", async () => {
  const response = await vacations.POST(
    request("/api/vacations", linkedUser, {
      changes: [{ doctorId: doctor.id, date: "2026-10-06", color: "red" }],
    }),
  );
  assert.equal(response.status, 200);
  const days = await (
    await vacations.GET(request("/api/vacations?year=2026"))
  ).json();
  assert.equal(days[0].approved, false);
  assert.equal(
    (
      await vacations.POST(
        request("/api/vacations", linkedUser, {
          changes: [
            { doctorId: doctor.id + 1, date: "2026-10-06", color: "red" },
          ],
        }),
      )
    ).status,
    403,
  );
});
test("night-shift ranges save atomically with role checks and stale-version protection", async () => {
  const secretary = db
    .insert(users)
    .values({
      email: "secretary@example.invalid",
      passwordHash: "unused",
      role: "secretary",
    })
    .returning()
    .get()!;
  const changes = ["2026-06-01", "2026-06-02", "2026-06-03"].map((date) => ({
    date,
    doctorIds: [doctor.id],
    expectedVersion: 0,
  }));
  const put = (actor = secretary, values: unknown = changes) =>
    annual.PUT(
      new NextRequest("http://localhost/api/night-shifts", {
        method: "PUT",
        headers: {
          authorization: `Bearer ${signAccessToken(actor)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shifts: values }),
      }),
    );
  assert.equal((await put(linkedUser)).status, 403);
  assert.equal(
    (await put(secretary, [{ ...changes[0], doctorIds: [99999] }])).status,
    400,
  );
  assert.equal((await put(secretary, null)).status, 400);
  const response = await put();
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.length, 3);
  assert(
    saved.every(
      (shift: { shiftType: string; version: number }) =>
        shift.shiftType === "night" && shift.version === 1,
    ),
  );
  assert.equal(
    (
      await put(secretary, [
        { ...changes[0], doctorIds: [], expectedVersion: 1 },
        { ...changes[1], doctorIds: [], expectedVersion: 0 },
      ])
    ).status,
    409,
  );
  const unchanged = db
    .select()
    .from(shifts)
    .where(eq(shifts.date, changes[0].date))
    .get()!;
  assert.deepEqual(unchanged.doctorIds, [doctor.id]);
  assert.equal(unchanged.version, 1);
});
test("doctor settings store JSON arrays without double encoding", async () => {
  const response = await doctorRoutes.PATCH(
    request("/api/doctors", assigner, {
      id: doctor.id,
      unavailableShiftTypes: ["night"],
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(
    db.select().from(doctors).where(eq(doctors.id, doctor.id)).get()!
      .unavailableShiftTypes,
    ["night"],
  );
});
test("calendar email previews bind sends to the schedule and retries do not create duplicate mock deliveries", async () => {
  const folder = await mkdtemp(join(tmpdir(), "shift-mail-test-"));
  process.env.MOCK_EMAIL_FOLDER = folder;
  try {
    const preview = await previewMonthCalendarEmails("2026-10", "shifts");
    assert.equal(preview.deliveredCount, 1);
    await assert.rejects(
      sendMonthCalendarEmails("2026-10", "shifts", "wrong-revision"),
    );
    const first = await sendMonthCalendarEmails(
      "2026-10",
      "shifts",
      preview.revision,
    );
    const repeated = await sendMonthCalendarEmails(
      "2026-10",
      "shifts",
      preview.revision,
    );
    assert.equal(first.deliveredCount, 1);
    assert.equal(repeated.deliveredCount, 1);
    assert.equal(
      first.deliveries[0].outputPath,
      repeated.deliveries[0].outputPath,
    );
    assert.equal((await readdir(join(folder, linkedUser.email))).length, 1);
    assert.equal(db.select().from(calendarEmailDeliveries).all().length, 1);
    db.update(shifts)
      .set({ version: 2 })
      .where(eq(shifts.date, "2026-10-05"))
      .run();
    await assert.rejects(
      sendMonthCalendarEmails("2026-10", "shifts", preview.revision),
    );
  } finally {
    delete process.env.MOCK_EMAIL_FOLDER;
    await rm(folder, { recursive: true, force: true });
  }
});
