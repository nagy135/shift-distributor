"use client";

import React from "react";
import { eachDayOfInterval, endOfMonth, format, startOfMonth } from "date-fns";
import { de } from "date-fns/locale";
import type { Shift, Doctor } from "@/lib/api";
import {
  SHIFT_TABLE_COLUMNS,
  type CalendarShiftColumn,
  doesCalendarShiftUnavailableDateClash,
  isDayDutyShiftType,
  isShiftType,
} from "@/lib/shifts";
import { cn } from "@/lib/utils";
import { HOLIDAY_DATE_SET_2026 } from "@/lib/holidays";

interface MonthlyShiftTableProps {
  month: Date;
  shifts: Shift[];
  doctors: Doctor[];
  unavailableByDoctor?: Record<number, Set<string>>;
  approvedVacationsByDate?: Record<string, string[]>;
  columns?: readonly CalendarShiftColumn[];
  onRowClick?: (date: Date) => void;
  onCellClick?: (date: Date, shiftType: string) => void;
}

export function MonthlyShiftTable({
  month,
  shifts,
  doctors,
  unavailableByDoctor = {},
  approvedVacationsByDate = {},
  columns = SHIFT_TABLE_COLUMNS,
  onRowClick,
  onCellClick,
}: MonthlyShiftTableProps) {
  const days = React.useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(month),
      end: endOfMonth(month),
    });
  }, [month]);

  const shiftIndex = React.useMemo(() => {
    const map = new Map<string, Record<string, Shift>>();
    for (const s of shifts) {
      const byType = map.get(s.date) ?? {};
      byType[s.shiftType] = s;
      map.set(s.date, byType);
    }
    return map;
  }, [shifts]);

  const doctorIdByName = React.useMemo(() => {
    return new Map(doctors.map((doctor) => [doctor.name, doctor.id]));
  }, [doctors]);

  // Helper function to check if a shift assignment violates constraints
  const hasDoctorConflict = React.useCallback(
    (
      doctorId: number,
      shift: Shift,
      date: string,
      byType: Record<string, Shift>,
    ): boolean => {
      const hasDateConflict = doesCalendarShiftUnavailableDateClash(
        shift.shiftType,
      )
        ? (unavailableByDoctor[doctorId]?.has(date) ?? false)
        : false;

      const doctor = doctors.find((d) => d.id === doctorId);
      const hasShiftTypeConflict =
        isShiftType(shift.shiftType) &&
        doctor?.unavailableShiftTypes &&
        Array.isArray(doctor.unavailableShiftTypes)
          ? doctor.unavailableShiftTypes.includes(shift.shiftType)
          : false;

      const doctorHasNightShift =
        Array.isArray(byType.night?.doctorIds) &&
        byType.night.doctorIds.includes(doctorId);
      const doctorHasDayDuty = Object.entries(byType).some(
        ([shiftType, otherShift]) =>
          isDayDutyShiftType(shiftType) &&
          Array.isArray(otherShift.doctorIds) &&
          otherShift.doctorIds.includes(doctorId),
      );
      const hasNightOverlap =
        shift.shiftType === "night"
          ? doctorHasDayDuty
          : isDayDutyShiftType(shift.shiftType) && doctorHasNightShift;

      return hasDateConflict || hasShiftTypeConflict || hasNightOverlap;
    },
    [doctors, unavailableByDoctor],
  );

  const hasShiftConflict = React.useCallback(
    (
      shift: Shift,
      date: string,
      byType: Record<string, Shift>,
    ): boolean => {
      if (!Array.isArray(shift.doctorIds) || shift.doctorIds.length === 0)
        return false;
      return shift.doctorIds.some((doctorId) =>
        hasDoctorConflict(doctorId, shift, date, byType),
      );
    },
    [hasDoctorConflict],
  );

  const canRowClick = typeof onRowClick === "function";
  const canCellClick = typeof onCellClick === "function";

  return (
    <div className="w-full">
      <div className="max-w-full overflow-x-auto rounded-md border">
        <table className="w-max min-w-full text-sm">
          <thead className="bg-muted/50 border-b border-gray-400">
            <tr>
                <th
                  className="text-left px-1 py-1 w-[50px] border-r border-gray-400"
                  aria-label="Datum"
                />
              {columns.map((t, index) => (
                <th
                  key={t.id}
                  className={cn(
                    "text-center py-1",
                    index === 0
                      ? "pl-1 pr-1"
                      : "px-2 min-w-[120px] border-l border-gray-400",
                  )}
                >
                  <span className="flex flex-col items-center leading-tight">
                    <span>{t.label}</span>
                    {t.headerNote ? (
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {t.headerNote}
                      </span>
                    ) : null}
                  </span>
                </th>
              ))}
              <th className="text-center py-1 px-2 min-w-[140px] border-l border-gray-400">
                Urlaub
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-400">
            {days.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const isHoliday = HOLIDAY_DATE_SET_2026.has(key);
              const dayName = format(d, "EEEE", { locale: de });
              const dayPrefix = dayName.slice(0, 2);
              const byType = shiftIndex.get(key) ?? {};
              const vacationDoctors = approvedVacationsByDate[key] ?? [];
              const vacationDoctorIds = new Set<number>(
                vacationDoctors
                  .map((doctorName) => doctorIdByName.get(doctorName))
                  .filter(
                    (doctorId): doctorId is number =>
                      typeof doctorId === "number",
                    ),
              );
              const hasShiftConflictInRow = columns.some((column) => {
                const s = byType[column.id];
                return s && hasShiftConflict(s, key, byType);
              });
              const assignedDoctorIds = new Set<number>();
              columns.forEach((column) => {
                const s = byType[column.id];
                if (!s || !Array.isArray(s.doctorIds)) {
                  return;
                }
                s.doctorIds.forEach((doctorId) => {
                  assignedDoctorIds.add(doctorId);
                });
              });
              const hasVacationConflict = Array.from(vacationDoctorIds).some(
                (doctorId) => assignedDoctorIds.has(doctorId),
              );
              const rowConflict = hasShiftConflictInRow || hasVacationConflict;
              // Hide weekend-only shift content on weekdays
              const day = d.getDay();
              const isWeekend = day === 0 || day === 6;
              return (
                <tr
                  key={key}
                  className={cn(
                    canRowClick && "cursor-pointer",
                    !canRowClick && "cursor-default",
                    (isWeekend || isHoliday) && "bg-gray-200 dark:bg-gray-700",
                    rowConflict
                      ? "bg-red-100 dark:bg-red-800/40 hover:bg-red-200 dark:hover:bg-red-700/50 border rounded border-red-400 dark:border-red-500/70"
                      : undefined,
                  )}
                  onClick={() => {
                    if (!canRowClick) return;
                    onRowClick(d);
                  }}
                >
                  <td
                    className={cn(
                      "px-1 py-1 text-xs min-w-[50px] border-r border-gray-400",
                      (canRowClick || canCellClick) && "hover:bg-muted/30",
                    )}
                  >
                    <span className="inline-flex items-baseline gap-1">
                      <span>{format(d, "d.", { locale: de })}</span>
                      <span>
                        {isHoliday ? (
                          <span className="text-red-600">{dayPrefix}</span>
                        ) : (
                          dayPrefix
                        )}
                      </span>
                    </span>
                  </td>
                  {columns.map((column, index) => {
                    const s = byType[column.id];
                    const hasShiftCellConflict = s
                      ? hasShiftConflict(s, key, byType)
                      : false;
                    const hasVacationCellConflict =
                      !!s &&
                      Array.isArray(s.doctorIds) &&
                      s.doctorIds.some((doctorId) =>
                        vacationDoctorIds.has(doctorId),
                      );
                    const cellConflict =
                      hasShiftCellConflict || hasVacationCellConflict;
                    return (
                      <td
                        key={column.id}
                        className={cn(
                          "py-1 text-center",
                          index === 0
                            ? "pl-1 pr-1"
                            : "px-2 min-w-[120px] border-l border-gray-400",
                          canCellClick && "cursor-pointer",
                          cellConflict &&
                            "bg-red-300 dark:bg-red-700/80 hover:bg-red-300 dark:hover:bg-red-700/80",
                          !cellConflict &&
                            (canRowClick || canCellClick) &&
                            "hover:bg-muted/30",
                        )}
                        onClick={(event) => {
                          if (!canCellClick) return;
                          event.stopPropagation();
                          onCellClick(d, column.id);
                        }}
                      >
                        {s ? (
                          s.doctorIds.length > 0 ? (
                            <span>
                              {s.doctors
                                .map((assignedDoctor) => assignedDoctor.name)
                                .join("/")}
                            </span>
                          ) : (
                            "-"
                          )
                        ) : (
                          "-"
                        )}
                      </td>
                    );
                  })}
                  <td
                    className={cn(
                      "py-1 text-center px-2 min-w-[140px] border-l border-gray-400",
                      hasVacationConflict &&
                        "bg-red-300 dark:bg-red-700/80 hover:bg-red-300 dark:hover:bg-red-700/80",
                      !hasVacationConflict &&
                        (canRowClick || canCellClick) &&
                        "hover:bg-muted/30",
                    )}
                  >
                    {vacationDoctors.length > 0
                      ? vacationDoctors.join("/")
                      : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
