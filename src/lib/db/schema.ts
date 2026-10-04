import { DEFAULT_USER_ROLE, type UserRole } from "@/lib/roles";
import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const doctors = sqliteTable("doctors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  color: text("color").default("black"),
  unavailableShiftTypes: text("unavailable_shift_types", { mode: "json" })
    .$type<string[]>()
    .default(sql`'[]'`)
    .notNull(), // JSON array of shift types the doctor cannot do
  disabled: integer("disabled", { mode: "boolean" }).default(false).notNull(),
  oa: integer("oa", { mode: "boolean" })
    .default(sql`0`)
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const shifts = sqliteTable(
  "shifts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(), // YYYY-MM-DD format
    shiftType: text("shift_type").notNull(), // see SHIFT_TYPES in src/lib/shifts.ts
    doctorIds: text("doctor_ids", { mode: "json" })
      .$type<number[]>()
      .notNull()
      .$default(() => []),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("shifts_date_type_unique").on(table.date, table.shiftType),
  ],
);

export const unavailableDates = sqliteTable(
  "unavailable_dates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    doctorId: integer("doctor_id")
      .references(() => doctors.id)
      .notNull(),
    date: text("date").notNull(), // YYYY-MM-DD format
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("unavailable_doctor_date_unique").on(
      table.doctorId,
      table.date,
    ),
  ],
);

export const unavailableDateChangeLogs = sqliteTable(
  "unavailable_date_change_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    doctorId: integer("doctor_id")
      .references(() => doctors.id)
      .notNull(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    addedCount: integer("added_count").default(0).notNull(),
    removedCount: integer("removed_count").default(0).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
);

export type UnavailableDateChangeType = "added" | "removed";

export const unavailableDateChangeLogEntries = sqliteTable(
  "unavailable_date_change_log_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    logId: integer("log_id")
      .references(() => unavailableDateChangeLogs.id)
      .notNull(),
    month: text("month").notNull(), // YYYY-MM format
    dayInMonth: integer("day_in_month").notNull(),
    changeType: text("change_type")
      .$type<UnavailableDateChangeType>()
      .notNull(),
  },
);

export const vacationDays = sqliteTable(
  "vacation_days",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    doctorId: integer("doctor_id")
      .references(() => doctors.id)
      .notNull(),
    date: text("date").notNull(), // YYYY-MM-DD format
    color: text("color").notNull(),
    approved: integer("approved", { mode: "boolean" })
      .default(sql`0`)
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => [
    uniqueIndex("vacation_doctor_date_unique").on(table.doctorId, table.date),
  ],
);

export const monthPublications = sqliteTable("month_publications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  month: text("month").notNull().unique(), // YYYY-MM format
  isPublished: integer("is_published", { mode: "boolean" })
    .default(sql`0`)
    .notNull(),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  publishedByUserId: integer("published_by_user_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<UserRole>().notNull().default(DEFAULT_USER_ROLE),
  admin: integer("admin", { mode: "boolean" })
    .default(sql`0`)
    .notNull(),
  doctorId: integer("doctor_id").references(() => doctors.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  lastOnlineAt: integer("last_online_at", { mode: "timestamp" }),
});

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  message: text("message").notNull(),
  isRead: integer("is_read", { mode: "boolean" })
    .default(sql`0`)
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const calendarEmailDeliveries = sqliteTable(
  "calendar_email_deliveries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    deliveryKey: text("delivery_key").notNull().unique(),
    status: text("status").$type<"sending" | "sent" | "uncertain">().notNull(),
    messageId: text("message_id"),
    outputPath: text("output_path"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
);

export type Doctor = typeof doctors.$inferSelect;
export type NewDoctor = typeof doctors.$inferInsert;
export type Shift = typeof shifts.$inferSelect;
export type NewShift = typeof shifts.$inferInsert;
export type UnavailableDate = typeof unavailableDates.$inferSelect;
export type NewUnavailableDate = typeof unavailableDates.$inferInsert;
export type UnavailableDateChangeLog =
  typeof unavailableDateChangeLogs.$inferSelect;
export type NewUnavailableDateChangeLog =
  typeof unavailableDateChangeLogs.$inferInsert;
export type UnavailableDateChangeLogEntry =
  typeof unavailableDateChangeLogEntries.$inferSelect;
export type NewUnavailableDateChangeLogEntry =
  typeof unavailableDateChangeLogEntries.$inferInsert;
export type VacationDay = typeof vacationDays.$inferSelect;
export type NewVacationDay = typeof vacationDays.$inferInsert;
export type MonthPublication = typeof monthPublications.$inferSelect;
export type NewMonthPublication = typeof monthPublications.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
