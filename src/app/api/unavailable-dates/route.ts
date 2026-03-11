import { NextRequest, NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { getUserFromAuthHeader } from "@/lib/authz";
import { db } from "@/lib/db";
import { unavailableDates } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromAuthHeader(
      request.headers.get("authorization"),
    );
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const doctorIdsParam = new URL(request.url).searchParams.get("doctorIds");
    const doctorIds = (doctorIdsParam ?? "")
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);

    const rows =
      doctorIds.length > 0
        ? await db
            .select()
            .from(unavailableDates)
            .where(inArray(unavailableDates.doctorId, doctorIds))
        : await db.select().from(unavailableDates);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching unavailable dates:", error);
    return NextResponse.json(
      { error: "Failed to fetch unavailable dates" },
      { status: 500 },
    );
  }
}
