import type { Shift as HydratedShift } from "@/lib/contracts";
import { getShiftLabel, SHIFT_TIME_RANGES } from "@/lib/shifts";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export type CalendarEmailContent = {
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

  return formatIcsTimestamp(date).replace(/Z$/, "");
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

export function foldIcsLine(line: string) {
  const parts: string[] = [];
  let current = "",
    length = 0;
  for (const character of line) {
    const bytes = Buffer.byteLength(character, "utf8");
    if (length + bytes > 75) {
      parts.push(current);
      current = " ";
      length = 1;
    }
    current += character;
    length += bytes;
  }
  parts.push(current);
  return parts.join("\r\n");
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

function getOtherDoctorNames(doctorId: number, shift: HydratedShift) {
  return shift.doctors
    .filter((doctor) => doctor.id !== doctorId)
    .map((doctor) => doctor.name);
}

function buildShiftLines(doctorId: number, monthlyShifts: HydratedShift[]) {
  return monthlyShifts.map((shift) => {
    const label = getShiftLabel(shift.shiftType);
    const otherDoctorNames = getOtherDoctorNames(doctorId, shift);
    const suffix =
      otherDoctorNames.length > 0 ? ` (${otherDoctorNames.join(", ")})` : "";

    return `- ${formatDisplayDate(shift.date)}: ${label}${suffix}`;
  });
}

export function buildCalendarIcs(params: {
  month: string;
  recipientEmail: string;
  doctorId: number;
  doctorName: string;
  monthlyShifts: HydratedShift[];
}) {
  const { month, recipientEmail, doctorId, doctorName, monthlyShifts } = params;
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
    ...(monthlyShifts.some(
      (shift) =>
        SHIFT_TIME_RANGES[shift.shiftType as keyof typeof SHIFT_TIME_RANGES],
    )
      ? [
          "BEGIN:VTIMEZONE",
          "TZID:Europe/Berlin",
          "BEGIN:DAYLIGHT",
          "DTSTART:19960331T020000",
          "TZOFFSETFROM:+0100",
          "TZOFFSETTO:+0200",
          "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
          "END:DAYLIGHT",
          "BEGIN:STANDARD",
          "DTSTART:19961027T030000",
          "TZOFFSETFROM:+0200",
          "TZOFFSETTO:+0100",
          "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
          "END:STANDARD",
          "END:VTIMEZONE",
        ]
      : []),
    ...monthlyShifts.flatMap((shift) => {
      const label = getShiftLabel(shift.shiftType);
      const otherDoctorNames = getOtherDoctorNames(doctorId, shift);
      const timeRange =
        SHIFT_TIME_RANGES[shift.shiftType as keyof typeof SHIFT_TIME_RANGES];
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
              `DTSTART;TZID=Europe/Berlin:${formatIcsDateTime(shift.date, from.hours, from.minutes)}`,
              `DTEND;TZID=Europe/Berlin:${formatIcsDateTime(shift.date, to.hours, to.minutes)}`,
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

export function buildCalendarEmailContent(params: {
  month: string;
  recipientEmail: string;
  doctorId: number;
  doctorName: string;
  monthlyShifts: HydratedShift[];
}) {
  const { month, recipientEmail, doctorId, doctorName, monthlyShifts } = params;
  const monthLabel = formatMonthLabel(month);
  const shiftLines = buildShiftLines(doctorId, monthlyShifts);
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
    ...(shiftLines.length > 0
      ? ["", "Zugeordnete Dienste:", ...shiftLines]
      : []),
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
            doctorId,
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
