"use client";

import { isSameMonth } from "date-fns";
import { Pill } from "@/components/ui/pill";
import type { Doctor, Shift } from "@/lib/api";

type DoctorShiftCountsProps = {
  doctors: Doctor[];
  shifts: Shift[];
  month: Date;
};

export function DoctorShiftCounts({
  doctors,
  shifts,
  month,
}: DoctorShiftCountsProps) {
  const shiftCounts = doctors
    .filter((doctor) => !doctor.disabled)
    .map((doctor) => {
      const doctorShifts = shifts.filter(
        (shift) =>
          Array.isArray(shift.doctorIds) &&
          shift.doctorIds.includes(doctor.id) &&
          isSameMonth(new Date(shift.date), month),
      );
      return {
        doctor,
        count: doctorShifts.length,
      };
    });

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {shiftCounts.map(({ doctor, count }) => (
        <Pill
          key={doctor.id}
          color={doctor.color || undefined}
          className="font-medium"
        >
          {doctor.name}: {count}
        </Pill>
      ))}
    </div>
  );
}
