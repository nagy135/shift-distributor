import { db } from "@/lib/db";
import {
  calendarEmailDeliveries,
  doctors,
  shifts,
  users,
} from "@/lib/db/schema";
import { hydrateShiftRows } from "@/lib/server/shift-route-helpers";
import { DEPARTMENT_SHIFT_TYPES, SHIFT_TYPES } from "@/lib/shifts";
import { asc, eq, like } from "drizzle-orm";
import { mkdir, writeFile } from "fs/promises";
import { createHash } from "node:crypto";
import nodemailer from "nodemailer";
import path from "path";
import { buildCalendarEmailContent } from "./calendar-email-content";
import {
  buildCalendarMailOptions,
  buildMockMarkdown,
  buildRawMimeEmail,
  resolveSmtpConfig,
  sanitizePathSegment,
} from "./calendar-email-transport";
import { InputError } from "./errors";

import type {
  Shift as HydratedShift,
  MonthCalendarEmailDelivery,
  MonthCalendarEmailResult,
} from "@/lib/contracts";
import type { CalendarEmailContent } from "./calendar-email-content";
export type { MonthCalendarEmailResult } from "@/lib/contracts";

type MonthCalendarRecipient = {
  email: string;
  doctorId: number | null;
  doctorName: string | null;
};

const MOCK_EMAIL_FOLDER_ENV = "MOCK_EMAIL_FOLDER";
function addSkippedResult(
  result: MonthCalendarEmailResult,
  email: string,
  reason: string,
) {
  result.skipped.push({ email, reason });
  result.skippedCount += 1;
}

function addDeliveredResult(
  result: MonthCalendarEmailResult,
  delivery: MonthCalendarEmailDelivery,
) {
  result.deliveries.push(delivery);
  result.deliveredCount += 1;
}

type PlannedCalendarEmail = {
  email: string;
  doctorName: string;
  shiftCount: number;
  emailContent: CalendarEmailContent;
};

function createMonthCalendarEmailResult(
  month: string,
  scope: "shifts" | "departments",
): MonthCalendarEmailResult {
  const mockFolder = process.env[MOCK_EMAIL_FOLDER_ENV]?.trim();
  const mockBasePath = mockFolder ? path.resolve(mockFolder) : null;

  return {
    month,
    scope,
    mode: mockBasePath ? "mock" : "smtp",
    mockBasePath,
    revision: "",
    deliveredCount: 0,
    skippedCount: 0,
    deliveries: [],
    skipped: [],
  };
}

async function buildMonthCalendarEmailPlan(
  month: string,
  scope: "shifts" | "departments",
) {
  return db.transaction((transaction) => {
    const recipients: MonthCalendarRecipient[] = transaction
      .select({
        email: users.email,
        doctorId: users.doctorId,
        doctorName: doctors.name,
      })
      .from(users)
      .leftJoin(doctors, eq(users.doctorId, doctors.id))
      .orderBy(asc(users.email))
      .all();

    const shiftRows = transaction
      .select()
      .from(shifts)
      .where(like(shifts.date, `${month}-%`))
      .orderBy(asc(shifts.date), asc(shifts.shiftType))
      .all();
    const activeShiftTypes = new Set<string>(
      scope === "shifts" ? SHIFT_TYPES : DEPARTMENT_SHIFT_TYPES,
    );
    const scopedShiftRows = shiftRows.filter((shift) =>
      activeShiftTypes.has(shift.shiftType),
    );
    const monthlyShifts = hydrateShiftRows(scopedShiftRows, transaction);
    return planCalendarEmails(month, scope, recipients, monthlyShifts);
  });
}

export function planCalendarEmails(
  month: string,
  scope: "shifts" | "departments",
  recipients: MonthCalendarRecipient[],
  monthlyShifts: HydratedShift[],
) {
  const result = createMonthCalendarEmailResult(month, scope);
  result.revision = createHash("sha256")
    .update(
      JSON.stringify({
        month,
        scope,
        recipients,
        monthlyShifts,
        mode: result.mode,
        mockBasePath: result.mockBasePath,
      }),
    )
    .digest("hex");
  const shiftsByDoctorId = new Map<number, HydratedShift[]>();

  monthlyShifts.forEach((shift) => {
    shift.doctorIds.forEach((doctorId) => {
      const current = shiftsByDoctorId.get(doctorId) ?? [];
      current.push(shift);
      shiftsByDoctorId.set(doctorId, current);
    });
  });

  const plannedDeliveries: PlannedCalendarEmail[] = [];

  for (const recipient of recipients) {
    if (typeof recipient.doctorId !== "number" || !recipient.doctorName) {
      addSkippedResult(
        result,
        recipient.email,
        "Dem Benutzer ist kein Arzt zugeordnet.",
      );
      continue;
    }

    const emailContent = buildCalendarEmailContent({
      month,
      recipientEmail: recipient.email,
      doctorId: recipient.doctorId,
      doctorName: recipient.doctorName,
      monthlyShifts: shiftsByDoctorId.get(recipient.doctorId) ?? [],
    });

    if (emailContent.shiftCount === 0) {
      addSkippedResult(
        result,
        recipient.email,
        "Für diesen Monat sind keine Dienste zugeordnet.",
      );
      continue;
    }

    plannedDeliveries.push({
      email: recipient.email,
      doctorName: recipient.doctorName,
      shiftCount: emailContent.shiftCount,
      emailContent,
    });
  }

  return {
    result,
    plannedDeliveries,
  };
}

export async function previewMonthCalendarEmails(
  month: string,
  scope: "shifts" | "departments",
): Promise<MonthCalendarEmailResult> {
  const { result, plannedDeliveries } = await buildMonthCalendarEmailPlan(
    month,
    scope,
  );

  plannedDeliveries.forEach((delivery) => {
    addDeliveredResult(result, {
      email: delivery.email,
      doctorName: delivery.doctorName,
      shiftCount: delivery.shiftCount,
      outputPath: null,
      messageId: null,
    });
  });

  return result;
}

export async function sendMonthCalendarEmails(
  month: string,
  scope: "shifts" | "departments",
  expectedRevision: string,
): Promise<MonthCalendarEmailResult> {
  const { result, plannedDeliveries } = await buildMonthCalendarEmailPlan(
    month,
    scope,
  );
  if (expectedRevision !== result.revision)
    throw new InputError(
      "Der Plan oder die Empfänger wurden inzwischen geändert. Bitte Vorschau erneut öffnen.",
      409,
      "STALE_EMAIL_PREVIEW",
    );
  const mockBasePath = result.mockBasePath;

  if (mockBasePath) {
    await mkdir(mockBasePath, { recursive: true });
  }

  const smtpConfig = mockBasePath ? null : resolveSmtpConfig();
  const effectiveFrom =
    smtpConfig?.from ??
    process.env.SMTP_FROM?.trim() ??
    "shift-distributor@example.invalid";
  const transporter = smtpConfig
    ? nodemailer.createTransport(smtpConfig)
    : null;

  for (const recipient of plannedDeliveries) {
    const deliveryKey = `${result.revision}:${recipient.email}`;
    const existing = db
      .select()
      .from(calendarEmailDeliveries)
      .where(eq(calendarEmailDeliveries.deliveryKey, deliveryKey))
      .get();
    if (existing?.status === "sent") {
      addDeliveredResult(result, {
        email: recipient.email,
        doctorName: recipient.doctorName,
        shiftCount: recipient.shiftCount,
        outputPath: existing.outputPath,
        messageId: existing.messageId,
      });
      continue;
    }
    const claimed = db
      .insert(calendarEmailDeliveries)
      .values({ deliveryKey, status: "sending", createdAt: new Date() })
      .onConflictDoNothing()
      .returning()
      .get();
    if (!claimed) {
      addSkippedResult(
        result,
        recipient.email,
        "Versand läuft bereits oder benötigt eine Prüfung.",
      );
      continue;
    }
    const recordDelivery = (
      outputPath: string | null,
      messageId: string | null,
    ) =>
      db
        .update(calendarEmailDeliveries)
        .set({ status: "sent", outputPath, messageId })
        .where(eq(calendarEmailDeliveries.deliveryKey, deliveryKey))
        .run();
    const mailOptions = buildCalendarMailOptions(
      effectiveFrom,
      recipient.email,
      recipient.emailContent,
    );

    try {
      if (mockBasePath) {
        const recipientDirectory = path.join(
          mockBasePath,
          sanitizePathSegment(recipient.email),
        );
        const outputPath = path.join(
          recipientDirectory,
          `${result.revision}-dienstplan-${month}.md`,
        );
        const rawMime = await buildRawMimeEmail(mailOptions);
        const markdown = buildMockMarkdown({
          recipientEmail: recipient.email,
          doctorName: recipient.doctorName,
          month,
          shiftCount: recipient.shiftCount,
          text: recipient.emailContent.text,
          html: recipient.emailContent.html,
          icalEvent: recipient.emailContent.icalEvent,
          rawMime,
        });

        await mkdir(recipientDirectory, { recursive: true });
        await writeFile(outputPath, markdown, {
          encoding: "utf8",
          mode: 0o600,
        });
        recordDelivery(outputPath, null);

        addDeliveredResult(result, {
          email: recipient.email,
          doctorName: recipient.doctorName,
          shiftCount: recipient.shiftCount,
          outputPath,
          messageId: null,
        });
        continue;
      }

      if (!transporter || !smtpConfig) {
        addSkippedResult(
          result,
          recipient.email,
          "Der E-Mail-Versand ist nicht verfügbar.",
        );
        continue;
      }

      const info = await transporter.sendMail({
        ...mailOptions,
      });

      recordDelivery(null, info.messageId ?? null);
      addDeliveredResult(result, {
        email: recipient.email,
        doctorName: recipient.doctorName,
        shiftCount: recipient.shiftCount,
        outputPath: null,
        messageId: info.messageId ?? null,
      });
    } catch (error) {
      if (mockBasePath)
        db.delete(calendarEmailDeliveries)
          .where(eq(calendarEmailDeliveries.deliveryKey, deliveryKey))
          .run();
      else
        db.update(calendarEmailDeliveries)
          .set({ status: "uncertain" })
          .where(eq(calendarEmailDeliveries.deliveryKey, deliveryKey))
          .run();
      addSkippedResult(
        result,
        recipient.email,
        error instanceof Error ? error.message : "Unbekannter Versandfehler.",
      );
    }
  }

  return result;
}
