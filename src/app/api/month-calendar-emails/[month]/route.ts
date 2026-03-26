import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader } from "@/lib/authz";
import { isValidMonthKey } from "@/lib/month-publications";
import { isAssigner } from "@/lib/roles";
import {
  previewMonthCalendarEmails,
  sendMonthCalendarEmails,
} from "@/lib/server/month-calendar-emails";

async function resolveAuthorizedRequest(
  request: NextRequest,
  params: Promise<{ month: string }>,
) {
  const user = await getUserFromAuthHeader(request.headers.get("authorization"));

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!isAssigner(user.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
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
      error: NextResponse.json({ error: "Invalid month" }, { status: 400 }),
    };
  }

  if (!scope) {
    return {
      error: NextResponse.json({ error: "Invalid scope" }, { status: 400 }),
    };
  }

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
    console.error("Error previewing month calendar emails:", error);
    return NextResponse.json(
      { error: "Failed to preview month calendar emails" },
      { status: 500 },
    );
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
    const result = await sendMonthCalendarEmails(resolved.month, resolved.scope);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error sending month calendar emails:", error);
    return NextResponse.json(
      { error: "Failed to send month calendar emails" },
      { status: 500 },
    );
  }
}
