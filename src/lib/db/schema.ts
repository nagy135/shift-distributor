import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { DEFAULT_USER_ROLE, type UserRole } from "@/lib/roles";

export const doctors = sqliteTable("doctors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  color: text("color").default("black"),
  unavailableShiftTypes: text("unavailable_shift_types", { mode: "json" })
    .default("[]")
    .notNull(), // JSON array of shift types the doctor cannot do
  disabled: integer("disabled", { mode: "boolean" }).default(false).notNull(),
  oa: integer("oa", { mode: "boolean" })
    .default(sql`0`)
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const shifts = sqliteTable("shifts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // YYYY-MM-DD format
  shiftType: text("shift_type").notNull(), // see SHIFT_TYPES in src/lib/shifts.ts
  doctorIds: text("doctor_ids", { mode: "json" })
    .$type<number[]>()
    .notNull()
    .$default(() => []),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const unavailableDates = sqliteTable("unavailable_dates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  doctorId: integer("doctor_id")
    .references(() => doctors.id)
    .notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<UserRole>().notNull().default(DEFAULT_USER_ROLE),
  doctorId: integer("doctor_id").references(() => doctors.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export type Doctor = typeof doctors.$inferSelect;
export type NewDoctor = typeof doctors.$inferInsert;
export type Shift = typeof shifts.$inferSelect;
export type NewShift = typeof shifts.$inferInsert;
export type UnavailableDate = typeof unavailableDates.$inferSelect;
export type NewUnavailableDate = typeof unavailableDates.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
