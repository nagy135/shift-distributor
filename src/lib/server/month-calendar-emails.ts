import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { asc, eq, like } from "drizzle-orm";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { doctors, shifts, users } from "@/lib/db/schema";
import {
  DEPARTMENT_SHIFT_TYPES,
  getShiftLabel,
  SHIFT_TIME_RANGES,
  SHIFT_TYPES,
} from "@/lib/shifts";
import { hydrateShiftRows } from "@/lib/server/shift-route-helpers";

type HydratedShift = Awaited<ReturnType<typeof hydrateShiftRows>>[number];

type MonthCalendarRecipient = {
  email: string;
  doctorId: number | null;
  doctorName: string | null;
};

type CalendarEmailContent = {
  subject: string;
  text: string;
  html: string;
  markdown: string;
  shiftCount: number;
  icalEvent?: {
    filename: string;
    content: string;
    contentType: string;
    method: "PUBLISH";
  };
};

type CalendarMailOptions = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  icalEvent?: {
    filename: string;
    method: "PUBLISH";
    content: string;
  };
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  from: string;
  auth?: {
    user: string;
    pass: string;
  };
};

export type MonthCalendarEmailMode = "mock" | "smtp";

export type MonthCalendarEmailDelivery = {
  email: string;
  doctorName: string;
  shiftCount: number;
  outputPath: string | null;
  messageId: string | null;
};

export type MonthCalendarEmailSkip = {
  email: string;
  reason: string;
};

export type MonthCalendarEmailResult = {
  month: string;
  scope: "shifts" | "departments";
  mode: MonthCalendarEmailMode;
  mockBasePath: string | null;
  deliveredCount: number;
  skippedCount: number;
  deliveries: MonthCalendarEmailDelivery[];
  skipped: MonthCalendarEmailSkip[];
};

const MOCK_EMAIL_FOLDER_ENV = "MOCK_EMAIL_FOLDER";
const DISPLAY_DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

function toMonthDate(month: string) {
  return new Date(`${month}-01T12:00:00Z`);
}

function formatMonthLabel(month: string) {
  return format(toMonthDate(month), "MMMM yyyy", { locale: de });
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return {
    year,
    month,
    day,
  };
}

function createUtcDate(value: string) {
  const { year, month, day } = parseIsoDate(value);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDisplayDate(value: string) {
  return DISPLAY_DATE_FORMATTER.format(createUtcDate(value));
}

function formatIcsDate(value: string) {
  const { year, month, day } = parseIsoDate(value);

  return `${String(year).padStart(4, "0")}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

function addDaysToIsoDate(value: string, amount: number) {
  const date = createUtcDate(value);
  date.setUTCDate(date.getUTCDate() + amount);

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function formatIcsDateTime(value: string, hours: number, minutes: number) {
  const { year, month, day } = parseIsoDate(value);
  const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

  return formatIcsTimestamp(date);
}

function parseTimeValue(value: `${number}:${number}`) {
  const [hours, minutes] = value.split(":").map(Number);

  return {
    hours,
    minutes,
  };
}

function formatIcsTimestamp(value: Date) {
  return `${value.getUTCFullYear()}${String(value.getUTCMonth() + 1).padStart(2, "0")}${String(value.getUTCDate()).padStart(2, "0")}T${String(value.getUTCHours()).padStart(2, "0")}${String(value.getUTCMinutes()).padStart(2, "0")}${String(value.getUTCSeconds()).padStart(2, "0")}Z`;
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldIcsLine(line: string) {
  const maxLineLength = 74;

  if (line.length <= maxLineLength) {
    return line;
  }

  const parts: string[] = [];
  let remaining = line;

  while (remaining.length > maxLineLength) {
    parts.push(remaining.slice(0, maxLineLength));
    remaining = remaining.slice(maxLineLength);
  }

  parts.push(remaining);

  return parts.join("\r\n ");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeUidPart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function sanitizePathSegment(value: string) {
  return value.replace(/[<>:\"/\\|?*\u0000-\u001F]/g, "_");
}

function formatFileTimestamp(value: Date) {
  return value.toISOString().replace(/[:.]/g, "-");
}

function parseBooleanEnv(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return null;
}

function resolveSmtpConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST?.trim();
  const from = (process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "").trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  const secureFromEnv = parseBooleanEnv(process.env.SMTP_SECURE);
  const parsedPort = Number(process.env.SMTP_PORT ?? "");

  if (!host) {
    throw new Error("SMTP_HOST is required when MOCK_EMAIL_FOLDER is not set.");
  }

  if (!from) {
    throw new Error(
      "SMTP_FROM or SMTP_USER is required when MOCK_EMAIL_FOLDER is not set.",
    );
  }

  if ((smtpUser && !smtpPass) || (!smtpUser && smtpPass)) {
    throw new Error("SMTP_USER and SMTP_PASS must be provided together.");
  }

  const secure =
    secureFromEnv ??
    (Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort === 465 : false);
  const port =
    Number.isInteger(parsedPort) && parsedPort > 0
      ? parsedPort
      : secure
        ? 465
        : 587;

  return {
    host,
    port,
    secure,
    from,
    auth:
      smtpUser && smtpPass
        ? {
            user: smtpUser,
            pass: smtpPass,
          }
        : undefined,
  };
}

function getOtherDoctorNames(doctorName: string, shift: HydratedShift) {
  return shift.doctors
    .map((doctor) => doctor.name)
    .filter((name) => name !== doctorName);
}

function buildShiftLines(doctorName: string, monthlyShifts: HydratedShift[]) {
  return monthlyShifts.map((shift) => {
    const label = getShiftLabel(shift.shiftType);
    const otherDoctorNames = getOtherDoctorNames(doctorName, shift);
    const suffix =
      otherDoctorNames.length > 0 ? ` (${otherDoctorNames.join(", ")})` : "";

    return `- ${formatDisplayDate(shift.date)}: ${label}${suffix}`;
  });
}

function buildCalendarIcs(params: {
  month: string;
  recipientEmail: string;
  doctorName: string;
  monthlyShifts: HydratedShift[];
}) {
  const { month, recipientEmail, doctorName, monthlyShifts } = params;
  const monthLabel = formatMonthLabel(month);
  const timestamp = formatIcsTimestamp(new Date());
  const calendarName = `Dienstplan ${doctorName} ${monthLabel}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Shift Distributor//Month Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    `X-WR-CALDESC:${escapeIcsText(`Dienstplan ${monthLabel} fuer ${doctorName}`)}`,
    ...monthlyShifts.flatMap((shift) => {
      const label = getShiftLabel(shift.shiftType);
      const otherDoctorNames = getOtherDoctorNames(doctorName, shift);
      const timeRange = SHIFT_TIME_RANGES[shift.shiftType as keyof typeof SHIFT_TIME_RANGES];
      const descriptionLines = [
        `Arzt: ${doctorName}`,
        `Dienst: ${label}`,
        `Datum: ${formatDisplayDate(shift.date)}`,
      ];

      if (otherDoctorNames.length > 0) {
        descriptionLines.push(`Mit eingeteilt: ${otherDoctorNames.join(", ")}`);
      }

      if (timeRange) {
        descriptionLines.push(`Zeit: ${timeRange.from}-${timeRange.to}`);
      }

      const dateLines = timeRange
        ? (() => {
            const from = parseTimeValue(timeRange.from);
            const to = parseTimeValue(timeRange.to);

            return [
              `DTSTART:${formatIcsDateTime(shift.date, from.hours, from.minutes)}`,
              `DTEND:${formatIcsDateTime(shift.date, to.hours, to.minutes)}`,
            ];
          })()
        : [
            `DTSTART;VALUE=DATE:${formatIcsDate(shift.date)}`,
            `DTEND;VALUE=DATE:${formatIcsDate(addDaysToIsoDate(shift.date, 1))}`,
          ];

      return [
        "BEGIN:VEVENT",
        `UID:${escapeIcsText(`shift-distributor-${shift.id}-${sanitizeUidPart(recipientEmail)}@calendar`)}`,
        `DTSTAMP:${timestamp}`,
        ...dateLines,
        `SUMMARY:${escapeIcsText(`Dienst: ${label}`)}`,
        `DESCRIPTION:${escapeIcsText(descriptionLines.join("\n"))}`,
        "STATUS:CONFIRMED",
        "TRANSP:OPAQUE",
        "END:VEVENT",
      ];
    }),
    "END:VCALENDAR",
  ];

  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

function buildCalendarEmailContent(params: {
  month: string;
  recipientEmail: string;
  doctorName: string;
  monthlyShifts: HydratedShift[];
}) {
  const { month, recipientEmail, doctorName, monthlyShifts } = params;
  const monthLabel = formatMonthLabel(month);
  const shiftLines = buildShiftLines(doctorName, monthlyShifts);
  const subject = `Dienstplan ${monthLabel} fuer ${doctorName}`;
  const greeting = `Hallo ${doctorName},`;
  const intro =
    monthlyShifts.length > 0
      ? `im Anhang findest du deinen Dienstplan fuer ${monthLabel} als iCalendar-Datei. Die Datei kann in Outlook direkt geoeffnet oder in Google Kalender importiert werden.`
      : `fuer ${monthLabel} sind aktuell keine Dienste eingetragen.`;
  const text = [
    greeting,
    "",
    intro,
    ...(shiftLines.length > 0 ? ["", "Zugeordnete Dienste:", ...shiftLines] : []),
    "",
    "Viele Gruesse",
    "Shift Distributor",
  ].join("\n");
  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    `<p>${escapeHtml(intro)}</p>`,
    shiftLines.length > 0
      ? `<p>Zugeordnete Dienste:</p><ul>${shiftLines
          .map((line) => `<li>${escapeHtml(line.slice(2))}</li>`)
          .join("")}</ul>`
      : "",
    "<p>Viele Gruesse<br />Shift Distributor</p>",
  ].join("");
  const icalEvent =
    monthlyShifts.length > 0
      ? {
          filename: `dienstplan-${month}.ics`,
          content: buildCalendarIcs({
            month,
            recipientEmail,
            doctorName,
            monthlyShifts,
          }),
          contentType: "text/calendar; charset=utf-8; method=PUBLISH",
          method: "PUBLISH" as const,
        }
      : undefined;
  const markdown = [
    "# Mock email",
    "",
    `- To: ${recipientEmail}`,
    `- Subject: ${subject}`,
    `- Doctor: ${doctorName}`,
    `- Month: ${month}`,
    `- Shifts: ${monthlyShifts.length}`,
    "",
    "## Text body",
    "",
    "```text",
    text,
    "```",
    "",
    "## HTML body",
    "",
    "```html",
    html,
    "```",
    "",
    "## Calendar attachment",
    "",
    ...(icalEvent
      ? [
          `- Filename: ${icalEvent.filename}`,
          `- Content-Type: ${icalEvent.contentType}`,
          "",
          "```ics",
          icalEvent.content.trimEnd(),
          "```",
        ]
      : ["- No calendar attachment generated."]),
  ].join("\n");

  return {
    subject,
    text,
    html,
    markdown,
    shiftCount: monthlyShifts.length,
    icalEvent,
  } satisfies CalendarEmailContent;
}

function buildCalendarMailOptions(
  smtpFrom: string,
  recipientEmail: string,
  emailContent: CalendarEmailContent,
): CalendarMailOptions {
  return {
    from: smtpFrom,
    to: recipientEmail,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
    ...(emailContent.icalEvent
      ? {
          icalEvent: {
            filename: emailContent.icalEvent.filename,
            method: emailContent.icalEvent.method,
            content: emailContent.icalEvent.content,
          },
        }
      : {}),
  };
}

async function buildRawMimeEmail(mailOptions: CalendarMailOptions) {
  const rawTransport = nodemailer.createTransport({
    buffer: true,
    newline: "windows",
    streamTransport: true,
  }) as {
    sendMail: (
      options: CalendarMailOptions,
    ) => Promise<{ message?: string | Buffer }>;
  };
  const info = await rawTransport.sendMail(mailOptions);

  if (Buffer.isBuffer(info.message)) {
    return info.message.toString("utf8");
  }

  return info.message ?? "";
}

function buildMockMarkdown(params: {
  recipientEmail: string;
  doctorName: string;
  month: string;
  shiftCount: number;
  text: string;
  html: string;
  icalEvent?: CalendarEmailContent["icalEvent"];
  rawMime: string;
}) {
  const {
    recipientEmail,
    doctorName,
    month,
    shiftCount,
    text,
    html,
    icalEvent,
    rawMime,
  } = params;

  return [
    "# Mock email",
    "",
    `- To: ${recipientEmail}`,
    `- Doctor: ${doctorName}`,
    `- Month: ${month}`,
    `- Shifts: ${shiftCount}`,
    "",
    "## Text body",
    "",
    "```text",
    text,
    "```",
    "",
    "## HTML body",
    "",
    "```html",
    html,
    "```",
    "",
    "## Calendar attachment",
    "",
    ...(icalEvent
      ? [
          `- Filename: ${icalEvent.filename}`,
          `- Content-Type: ${icalEvent.contentType}`,
          "",
          "```ics",
          icalEvent.content.trimEnd(),
          "```",
        ]
      : ["- No calendar attachment generated."]),
    "",
    "## Raw MIME email",
    "",
    "Copy everything after the next line into an `.eml` file or an email testing tool to reproduce the real SMTP message.",
    "",
    "-----BEGIN RAW MIME EMAIL-----",
    rawMime.trimEnd(),
    "-----END RAW MIME EMAIL-----",
  ].join("\n");
}

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

export async function sendMonthCalendarEmails(
  month: string,
  scope: "shifts" | "departments",
): Promise<MonthCalendarEmailResult> {
  const mockFolder = process.env[MOCK_EMAIL_FOLDER_ENV]?.trim();
  const mockBasePath = mockFolder ? path.resolve(mockFolder) : null;
  const result: MonthCalendarEmailResult = {
    month,
    scope,
    mode: mockBasePath ? "mock" : "smtp",
    mockBasePath,
    deliveredCount: 0,
    skippedCount: 0,
    deliveries: [],
    skipped: [],
  };

  const recipients: MonthCalendarRecipient[] = await db
    .select({
      email: users.email,
      doctorId: users.doctorId,
      doctorName: doctors.name,
    })
    .from(users)
    .leftJoin(doctors, eq(users.doctorId, doctors.id))
    .orderBy(asc(users.email));

  const shiftRows = await db
    .select()
    .from(shifts)
    .where(like(shifts.date, `${month}-%`))
    .orderBy(asc(shifts.date), asc(shifts.shiftType));
  const activeShiftTypes = new Set<string>(
    scope === "shifts" ? SHIFT_TYPES : DEPARTMENT_SHIFT_TYPES,
  );
  const scopedShiftRows = shiftRows.filter((shift) =>
    activeShiftTypes.has(shift.shiftType),
  );
  const monthlyShifts = await hydrateShiftRows(scopedShiftRows);
  const shiftsByDoctorId = new Map<number, HydratedShift[]>();

  monthlyShifts.forEach((shift) => {
    shift.doctorIds.forEach((doctorId) => {
      const current = shiftsByDoctorId.get(doctorId) ?? [];
      current.push(shift);
      shiftsByDoctorId.set(doctorId, current);
    });
  });

  if (mockBasePath) {
    await mkdir(mockBasePath, { recursive: true });
  }

  const smtpConfig = mockBasePath ? null : resolveSmtpConfig();
  const effectiveFrom = smtpConfig?.from ?? process.env.SMTP_FROM?.trim() ?? "shift-distributor@example.invalid";
  const transporter = smtpConfig
    ? nodemailer.createTransport(smtpConfig)
    : null;

  for (const recipient of recipients) {
    if (typeof recipient.doctorId !== "number" || !recipient.doctorName) {
      addSkippedResult(result, recipient.email, "No doctor linked to the user.");
      continue;
    }

    const emailContent = buildCalendarEmailContent({
      month,
      recipientEmail: recipient.email,
      doctorName: recipient.doctorName,
      monthlyShifts: shiftsByDoctorId.get(recipient.doctorId) ?? [],
    });

    if (emailContent.shiftCount === 0) {
      addSkippedResult(result, recipient.email, "No shifts assigned for this month.");
      continue;
    }

    const mailOptions = buildCalendarMailOptions(
      effectiveFrom,
      recipient.email,
      emailContent,
    );

    try {
      if (mockBasePath) {
        const recipientDirectory = path.join(
          mockBasePath,
          sanitizePathSegment(recipient.email),
        );
        const outputPath = path.join(
          recipientDirectory,
          `${formatFileTimestamp(new Date())}-dienstplan-${month}.md`,
        );
        const rawMime = await buildRawMimeEmail(mailOptions);
        const markdown = buildMockMarkdown({
          recipientEmail: recipient.email,
          doctorName: recipient.doctorName,
          month,
          shiftCount: emailContent.shiftCount,
          text: emailContent.text,
          html: emailContent.html,
          icalEvent: emailContent.icalEvent,
          rawMime,
        });

        await mkdir(recipientDirectory, { recursive: true });
        await writeFile(outputPath, markdown, "utf8");

        addDeliveredResult(result, {
          email: recipient.email,
          doctorName: recipient.doctorName,
          shiftCount: emailContent.shiftCount,
          outputPath,
          messageId: null,
        });
        continue;
      }

      if (!transporter || !smtpConfig) {
        addSkippedResult(result, recipient.email, "Mail transport is not available.");
        continue;
      }

      const info = await transporter.sendMail({
        ...mailOptions,
      });

      addDeliveredResult(result, {
        email: recipient.email,
        doctorName: recipient.doctorName,
        shiftCount: emailContent.shiftCount,
        outputPath: null,
        messageId: info.messageId ?? null,
      });
    } catch (error) {
      addSkippedResult(
        result,
        recipient.email,
        error instanceof Error ? error.message : "Unknown delivery error.",
      );
    }
  }

  return result;
}
