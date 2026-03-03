"use client";

import React from "react";
import { format, isSameMonth } from "date-fns";
import { HOLIDAY_DATE_SET_2026 } from "@/lib/holidays";
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
  const countColumns = React.useMemo(
    () => ["ND", "LD", "SD", "KD", "ITS"] as const,
    [],
  );

  const shiftCounts = doctors
    .filter((doctor) => !doctor.disabled && doctor.oa === false)
    .map((doctor) => {
      const counts: Record<(typeof countColumns)[number], number> = {
        ND: 0,
        LD: 0,
        SD: 0,
        KD: 0,
        ITS: 0,
      };

      for (const shift of shifts) {
        if (!Array.isArray(shift.doctorIds)) continue;
        if (!shift.doctorIds.includes(doctor.id)) continue;
        if (!isSameMonth(new Date(shift.date), month)) continue;

        const date = new Date(shift.date);
        const dateKey = format(date, "yyyy-MM-dd");
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const isHoliday = HOLIDAY_DATE_SET_2026.has(dateKey);
        const isWeekday = !isWeekend && !isHoliday;

        if (shift.shiftType === "night") {
          counts.ND += 1;
          continue;
        }

        if (shift.shiftType === "20shift") {
          if (isWeekday) counts.SD += 1;
          else counts.LD += 1;
          continue;
        }

        if (shift.shiftType === "17shift") {
          if (isWeekday) counts.ITS += 1;
          else counts.KD += 1;
        }
      }

      const total = countColumns.reduce((sum, column) => {
        if (column === "ITS") return sum;
        return sum + counts[column];
      }, 0);

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
    <div
      className={cn(
        "inline-block max-w-full overflow-x-auto rounded-md border",
        className,
      )}
    >
      <table className="w-fit text-sm border-collapse">
        <thead className="bg-muted/50 border-b border-gray-400">
          <tr>
            <th className="text-left px-2 py-1 whitespace-nowrap border-r border-gray-300">
              Arzt
            </th>
            {countColumns.map((column, index) => (
              <th
                key={column}
                className={cn(
                  "text-center px-2 py-1",
                  index < countColumns.length - 1 && "border-r border-gray-300",
                )}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-400">
          {shiftCounts.map(({ doctor, counts }) => (
            <tr key={doctor.id}>
              <td className="px-2 py-1 font-medium whitespace-nowrap border-r border-gray-300">
                {doctor.name}
              </td>
              {countColumns.map((column, index) => (
                <td
                  key={column}
                  className={cn(
                    "px-2 py-1 text-center tabular-nums",
                    index < countColumns.length - 1 && "border-r border-gray-300",
                  )}
                >
                  {counts[column]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
