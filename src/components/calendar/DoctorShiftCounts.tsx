"use client";

import React from "react";
import { format, isSameMonth } from "date-fns";
import { HOLIDAY_DATE_SET } from "@/lib/holidays";
import {
  getAutomaticNightShiftVacationDays,
  NIGHT_FREE_COLUMN_ID,
} from "@/lib/night-shift-vacations";
import { useDragToScroll } from "@/lib/use-drag-to-scroll";
import { cn } from "@/lib/utils";
import type { Doctor, Shift } from "@/lib/api";
import type { CalendarShiftColumn } from "@/lib/shifts";

type DoctorShiftCountsView = "shifts" | "departments";

type StatisticColumn = {
  id: string;
  label: string;
  headerNote?: string;
};

type DoctorShiftCountsProps = {
  doctors: Doctor[];
  shifts: Shift[];
  month: Date;
  columns: readonly CalendarShiftColumn[];
  view: DoctorShiftCountsView;
  className?: string;
};

export function DoctorShiftCounts({
  doctors,
  shifts,
  month,
  columns,
  view,
  className,
}: DoctorShiftCountsProps) {
  const { containerRef, isDragging, dragHandlers } =
    useDragToScroll<HTMLDivElement>();

  const displayColumns = React.useMemo(() => {
    if (view === "shifts") {
      return [
        { id: "ND", label: "ND", headerNote: undefined },
        { id: "LD", label: "LD", headerNote: undefined },
        { id: "SD", label: "SD", headerNote: undefined },
        { id: "KD", label: "KD", headerNote: undefined },
        { id: "ITS", label: "ITS", headerNote: undefined },
      ] satisfies readonly StatisticColumn[];
    }

    return columns.map((column) => ({
      id: column.id,
      label: column.slotLabel ?? column.label,
      headerNote: column.headerNote,
    })) satisfies readonly StatisticColumn[];
  }, [columns, view]);

  const shiftCounts = React.useMemo(() => {
    const automaticNightVacations = getAutomaticNightShiftVacationDays(shifts);

    return doctors
      .filter(
        (doctor) => !doctor.disabled && (view === "departments" || !doctor.oa),
      )
      .map((doctor) => {
        const counts = Object.fromEntries(
          displayColumns.map((column) => [column.id, 0]),
        ) as Record<string, number>;

        if (view === "departments") {
          automaticNightVacations.forEach((vacation) => {
            if (vacation.doctorId !== doctor.id) {
              return;
            }

            if (!isSameMonth(new Date(vacation.date), month)) {
              return;
            }

            if (NIGHT_FREE_COLUMN_ID in counts) {
              counts[NIGHT_FREE_COLUMN_ID] += 1;
            }
          });
        }

        for (const shift of shifts) {
          if (!Array.isArray(shift.doctorIds)) continue;
          if (!shift.doctorIds.includes(doctor.id)) continue;

          if (!isSameMonth(new Date(shift.date), month)) continue;

          if (view === "shifts") {
            const date = new Date(shift.date);
            const dateKey = format(date, "yyyy-MM-dd");
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const isHoliday = HOLIDAY_DATE_SET.has(dateKey);
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
            continue;
          }

          if (!(shift.shiftType in counts)) continue;

          counts[shift.shiftType] += 1;
        }

        const total = Object.entries(counts).reduce(
          (sum, [shiftType, value]) =>
            shiftType === "ITS" ? sum : sum + value,
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
  }, [displayColumns, doctors, month, shifts, view]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "max-w-full overflow-auto rounded-md border cursor-grab select-none",
        isDragging && "cursor-grabbing",
        className,
      )}
      {...dragHandlers}
    >
      <table className="w-max min-w-full text-[11px] border-collapse md:text-xs">
        <thead className="bg-muted/50 border-b border-gray-400">
          <tr>
            <th className="text-left px-1 py-0.5 whitespace-nowrap border-gray-300 md:px-1.5">
              Arzt
            </th>
            <th className="text-center px-0.5 py-0.5 border-x-1 border-black md:px-1 md:py-0.5">
              Gesamt
            </th>
            {displayColumns.map((column) => (
              <th
                key={column.id}
                className={cn(
                  "text-center px-0.5 py-0.5 md:px-1 md:py-0.5",
                  "border-r last:border-r-0 border-gray-300",
                )}
              >
                <span className="flex min-w-[42px] flex-col items-center leading-none md:min-w-[48px]">
                  <span>{column.label}</span>
                  {column.headerNote ? (
                    <span className="text-[8px] font-normal text-muted-foreground md:text-[9px]">
                      {column.headerNote}
                    </span>
                  ) : null}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-400">
          {shiftCounts.map(({ doctor, counts, total }) => (
            <tr key={doctor.id}>
              <td className="px-1 py-0.5 font-medium whitespace-nowrap md:px-1.5 md:py-0.5">
                {doctor.name}
              </td>
              <td className="px-0.5 py-0.5 text-center tabular-nums border-x-1 border-black md:px-1 md:py-0.5 font-bold">
                {total}
              </td>
              {displayColumns.map((column) => (
                <td
                  key={column.id}
                  className={cn(
                    "px-0.5 py-0.5 text-center tabular-nums md:px-1 md:py-0.5",
                    "border-r last:border-r-0 border-gray-300",
                  )}
                >
                  {column.id === "ITS" && counts[column.id] !== 0
                    ? `(${counts[column.id]})`
                    : counts[column.id]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
