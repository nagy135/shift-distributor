import { getUserFromAuthHeader } from "@/lib/authz";
import { isValidMonthKey } from "@/lib/month-publications";
import { canEditCalendarView, isAssigner } from "@/lib/roles";
import { apiError, readBody, requireValue } from "@/lib/server/errors";
import {
  previewMonthCalendarEmails,
  sendMonthCalendarEmails,
} from "@/lib/server/month-calendar-emails";
import { NextRequest, NextResponse } from "next/server";

async function resolveAuthorizedRequest(
  request: NextRequest,
  params: Promise<{ month: string }>,
) {
  const user = await getUserFromAuthHeader(
    request.headers.get("authorization"),
  );

  if (!user) {
    return {
      error: NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 }),
    };
  }

  if (!isAssigner(user.role)) {
    return {
      error: NextResponse.json(
        { error: "Keine Berechtigung." },
        { status: 403 },
      ),
    };
  }

  const { month } = await params;
  const scopeParam = new URL(request.url).searchParams.get("scope");
  const scope: "shifts" | "departments" | null =
    scopeParam === "departments"
      ? "departments"
      : scopeParam === "shifts"
        ? "shifts"
        : null;

  if (!isValidMonthKey(month)) {
    return {
      error: NextResponse.json({ error: "Ungültiger Monat." }, { status: 400 }),
    };
  }

  if (!scope) {
    return {
      error: NextResponse.json(
        { error: "Ungültiger Bereich." },
        { status: 400 },
      ),
    };
  }

  if (!canEditCalendarView(user.role, scope))
    return {
      error: NextResponse.json(
        { error: "Keine Berechtigung.", code: "FORBIDDEN" },
        { status: 403 },
      ),
    };
  return {
    month,
    scope,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ month: string }> },
) {
  const resolved = await resolveAuthorizedRequest(request, params);

  if ("error" in resolved) {
    return resolved.error;
  }

  try {
    const result = await previewMonthCalendarEmails(
      resolved.month,
      resolved.scope,
    );
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ month: string }> },
) {
  const resolved = await resolveAuthorizedRequest(request, params);

  if ("error" in resolved) {
    return resolved.error;
  }

  try {
    const body = await readBody(request);
    requireValue(
      typeof body.revision === "string",
      "Bitte zuerst Vorschau öffnen.",
    );
    const result = await sendMonthCalendarEmails(
      resolved.month,
      resolved.scope,
      body.revision,
    );
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
