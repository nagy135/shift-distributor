import { getUserFromAuthHeader } from "@/lib/authz";
import { db } from "@/lib/db";
import { monthPublications } from "@/lib/db/schema";
import { getMonthPublication, isValidMonthKey } from "@/lib/month-publications";
import { isAssigner } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ month: string }> },
) {
  const user = await getUserFromAuthHeader(
    request.headers.get("authorization"),
  );
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { month } = await params;
  if (!isValidMonthKey(month)) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  const publication = await getMonthPublication(month);
  return NextResponse.json(publication);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ month: string }> },
) {
  const user = await getUserFromAuthHeader(
    request.headers.get("authorization"),
  );
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAssigner(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { month } = await params;
  if (!isValidMonthKey(month)) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  const body = await request.json();
  const isPublished = body?.isPublished;

  if (typeof isPublished !== "boolean") {
    return NextResponse.json(
      { error: "isPublished must be a boolean" },
      { status: 400 },
    );
  }

  const now = new Date();
  const values = {
    isPublished,
    publishedAt: isPublished ? now : null,
    publishedByUserId: user.id,
    updatedAt: now,
  };
  await db
    .insert(monthPublications)
    .values({ month, ...values })
    .onConflictDoUpdate({ target: monthPublications.month, set: values });

  const publication = await getMonthPublication(month);
  return NextResponse.json(publication);
}
