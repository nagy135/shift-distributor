"use client";

import React from "react";
import { isSameMonth } from "date-fns";
import { SHIFT_DEFS, SHIFT_TYPES, type ShiftType } from "@/lib/shifts";
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
  const shiftTypes = React.useMemo(
    () => SHIFT_TYPES.filter((shiftType) => SHIFT_DEFS[shiftType].acronym),
    [],
  );

  const shiftCounts = doctors
    .filter((doctor) => !doctor.disabled)
    .map((doctor) => {
      const counts = Object.fromEntries(
        shiftTypes.map((shiftType) => [shiftType, 0]),
      ) as Record<ShiftType, number>;

      for (const shift of shifts) {
        if (!Array.isArray(shift.doctorIds)) continue;
        if (!shift.doctorIds.includes(doctor.id)) continue;
        if (!isSameMonth(new Date(shift.date), month)) continue;
        const shiftType = shift.shiftType as ShiftType;
        if (shiftType in counts) counts[shiftType] += 1;
      }

      const total = shiftTypes.reduce(
        (sum, shiftType) => sum + counts[shiftType],
        0,
      );

      return {
        doctor,
        counts,
        total,
      };
    })
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.doctor.name.localeCompare(b.doctor.name);
    });

  return (
    <div className={cn("overflow-x-auto rounded-md border", className)}>
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b border-gray-400">
          <tr>
            <th className="text-left px-2 py-1">Doctor</th>
            {shiftTypes.map((shiftType) => (
              <th key={shiftType} className="text-center px-2 py-1">
                {SHIFT_DEFS[shiftType].acronym}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-400">
          {shiftCounts.map(({ doctor, counts }) => (
            <tr key={doctor.id}>
              <td className="px-2 py-1 font-medium">{doctor.name}</td>
              {shiftTypes.map((shiftType) => (
                <td
                  key={shiftType}
                  className="px-2 py-1 text-center tabular-nums"
                >
                  {counts[shiftType]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
