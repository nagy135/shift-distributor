"use client";

import { isSameMonth } from "date-fns";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";
import type { Doctor, Shift } from "@/lib/api";

type DoctorShiftCountsProps = {
  doctors: Doctor[];
  shifts: Shift[];
  month: Date;
  className?: string;
};

export function DoctorShiftCounts({
  doctors,
  shifts,
  month,
  className,
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
    })
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.doctor.name.localeCompare(b.doctor.name);
    });

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 justify-center sm:justify-start lg:flex-col lg:flex-nowrap lg:items-start",
        className,
      )}
    >
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
