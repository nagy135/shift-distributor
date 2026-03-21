import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader } from "@/lib/authz";
import { isValidMonthKey } from "@/lib/month-publications";
import { isAssigner } from "@/lib/roles";
import { sendMonthCalendarEmails } from "@/lib/server/month-calendar-emails";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ month: string }> },
) {
  const user = await getUserFromAuthHeader(request.headers.get("authorization"));

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAssigner(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { month } = await params;
  const scopeParam = new URL(request.url).searchParams.get("scope");
  const scope =
    scopeParam === "departments" ? "departments" : scopeParam === "shifts" ? "shifts" : null;

  if (!isValidMonthKey(month)) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  if (!scope) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  try {
    const result = await sendMonthCalendarEmails(month, scope);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error sending month calendar emails:", error);
    return NextResponse.json(
      { error: "Failed to send month calendar emails" },
      { status: 500 },
    );
  }
}
