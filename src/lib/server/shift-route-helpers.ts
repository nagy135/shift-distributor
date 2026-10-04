import { db, type AppDatabase } from "@/lib/db";
import { doctors } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

type ShiftRowLike = {
  id: number;
  date: string;
  shiftType: string;
  doctorIds: unknown;
  version?: number;
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

export function hydrateShiftRows<T extends ShiftRowLike>(
  rows: T[],
  database: Pick<AppDatabase, "select"> = db,
) {
  const doctorIds = Array.from(
    new Set(rows.flatMap((row) => parseDoctorIds(row.doctorIds))),
  );
  const doctorMap = new Map<number, HydratedShiftDoctor>();

  if (doctorIds.length > 0) {
    const doctorRows = database
      .select({
        id: doctors.id,
        name: doctors.name,
        color: doctors.color,
      })
      .from(doctors)
      .where(inArray(doctors.id, doctorIds))
      .all();

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
      version: row.version ?? 1,
      doctors: normalizedDoctorIds.map((doctorId) => {
        const doctor = doctorMap.get(doctorId);

        return (
          doctor ?? { id: doctorId, name: `Arzt #${doctorId}`, color: null }
        );
      }),
    };
  });
}
