import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { doctors } from "@/lib/db/schema";

type ShiftRowLike = {
  id: number;
  date: string;
  shiftType: string;
  doctorIds: unknown;
};

export type HydratedShiftDoctor = {
  id: number;
  name: string;
  color: string | null;
};

export function parseDoctorIds(input: unknown): number[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const ids = input
    .map((value) => {
      if (typeof value === "number") {
        return value;
      }

      if (typeof value === "string" && value.trim() !== "") {
        const numericValue = Number(value);
        return Number.isNaN(numericValue) ? null : numericValue;
      }

      return null;
    })
    .filter(
      (value): value is number => value != null && Number.isInteger(value),
    );

  return Array.from(new Set(ids));
}

export async function hydrateShiftRows<T extends ShiftRowLike>(rows: T[]) {
  const doctorIds = Array.from(
    new Set(rows.flatMap((row) => parseDoctorIds(row.doctorIds))),
  );
  const doctorMap = new Map<number, HydratedShiftDoctor>();

  if (doctorIds.length > 0) {
    const doctorRows = await db
      .select({
        id: doctors.id,
        name: doctors.name,
        color: doctors.color,
      })
      .from(doctors)
      .where(inArray(doctors.id, doctorIds));

    for (const doctor of doctorRows) {
      doctorMap.set(doctor.id, {
        id: doctor.id,
        name: doctor.name,
        color: doctor.color ?? null,
      });
    }
  }

  return rows.map((row) => {
    const normalizedDoctorIds = parseDoctorIds(row.doctorIds);

    return {
      id: row.id,
      date: row.date,
      shiftType: row.shiftType,
      doctorIds: normalizedDoctorIds,
      doctors: normalizedDoctorIds.map((doctorId) => {
        const doctor = doctorMap.get(doctorId);

        return doctor ?? { id: doctorId, name: `Doctor #${doctorId}`, color: null };
      }),
    };
  });
}
