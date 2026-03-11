import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { doctors, unavailableDates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUserFromAuthHeader } from "@/lib/authz";
import { isAssigner } from "@/lib/roles";
import { withNormalizedUnavailableShiftTypes } from "@/lib/server/doctor-route-helpers";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromAuthHeader(
      request.headers.get("authorization"),
    );
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allDoctors = await db.select().from(doctors);

    const doctorsWithParsedTypes = allDoctors.map(
      withNormalizedUnavailableShiftTypes,
    );

    return NextResponse.json(doctorsWithParsedTypes);
  } catch (error) {
    console.error("Error fetching doctors:", error);
    return NextResponse.json(
      { error: "Failed to fetch doctors" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromAuthHeader(
      request.headers.get("authorization"),
    );
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAssigner(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const {
      name,
      color,
      unavailableDates: unavailableDatesList,
    } = await request.json();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Insert the doctor
    const [newDoctor] = await db
      .insert(doctors)
      .values({ name, color })
      .returning();

    // Insert unavailable dates if provided
    if (unavailableDatesList && unavailableDatesList.length > 0) {
      const unavailableDatesToInsert = unavailableDatesList.map(
        (date: string) => ({
          doctorId: newDoctor.id,
          date,
        }),
      );

      await db.insert(unavailableDates).values(unavailableDatesToInsert);
    }

    return NextResponse.json(newDoctor, { status: 201 });
  } catch (error) {
    console.error("Error creating doctor:", error);
    return NextResponse.json(
      { error: "Failed to create doctor" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromAuthHeader(
      request.headers.get("authorization"),
    );
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAssigner(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, color, name, unavailableShiftTypes, disabled, oa } =
      await request.json();
    if (!id) {
      return NextResponse.json(
        { error: "Doctor id is required" },
        { status: 400 },
      );
    }
    const updateValues: Record<string, unknown> = {};
    if (typeof color !== "undefined") {
      updateValues.color = color;
    }
    if (typeof name !== "undefined") {
      updateValues.name = name;
    }
    if (typeof unavailableShiftTypes !== "undefined") {
      updateValues.unavailableShiftTypes = Array.isArray(unavailableShiftTypes)
        ? JSON.stringify(unavailableShiftTypes)
        : unavailableShiftTypes;
    }
    if (typeof disabled !== "undefined") {
      updateValues.disabled = disabled;
    }
    if (typeof oa !== "undefined") {
      updateValues.oa = oa;
    }
    const [updated] = await db
      .update(doctors)
      .set(updateValues)
      .where(eq(doctors.id, id))
      .returning();
    const updatedWithParsedTypes = withNormalizedUnavailableShiftTypes(updated);

    return NextResponse.json(updatedWithParsedTypes);
  } catch (error) {
    console.error("Error updating doctor:", error);
    return NextResponse.json(
      { error: "Failed to update doctor" },
      { status: 500 },
    );
  }
}
