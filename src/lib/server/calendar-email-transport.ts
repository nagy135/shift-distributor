import nodemailer from "nodemailer";
import type { CalendarEmailContent } from "./calendar-email-content";

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

export function sanitizePathSegment(value: string) {
  return value.replace(/[<>:\"/\\|?*\u0000-\u001F]/g, "_");
}

export function formatFileTimestamp(value: Date) {
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

export function resolveSmtpConfig(): SmtpConfig {
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
    (Number.isInteger(parsedPort) && parsedPort > 0
      ? parsedPort === 465
      : false);
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

export function buildCalendarMailOptions(
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

export async function buildRawMimeEmail(mailOptions: CalendarMailOptions) {
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

export function buildMockMarkdown(params: {
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
