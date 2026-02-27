"use client";

import React from "react";
import { eachDayOfInterval, endOfMonth, format, startOfMonth } from "date-fns";
import { de } from "date-fns/locale";
import type { Shift, Doctor } from "@/lib/api";
import { SHIFT_LABELS, SHIFT_TYPES, type ShiftType } from "@/lib/shifts";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";
import { HOLIDAY_DATE_SET_2026 } from "@/lib/holidays";

interface MonthlyShiftTableProps {
  month: Date;
  shifts: Shift[];
  doctors: Doctor[];
  unavailableByDoctor?: Record<number, Set<string>>;
  onRowClick: (date: Date) => void;
  onCellClick?: (date: Date, shiftType: ShiftType) => void;
}

export function MonthlyShiftTable({
  month,
  shifts,
  doctors,
  unavailableByDoctor = {},
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
    const map = new Map<string, Partial<Record<ShiftType, Shift>>>();
    for (const s of shifts) {
      const byType = map.get(s.date) ?? {};
      byType[s.shiftType as ShiftType] = s;
      map.set(s.date, byType);
    }
    return map;
  }, [shifts]);

  // Helper function to check if a shift assignment violates constraints
  const hasDoctorConflict = React.useCallback(
    (
      doctorId: number,
      shift: Shift,
      date: string,
      byType: Partial<Record<ShiftType, Shift>>,
    ): boolean => {
      const hasDateConflict = unavailableByDoctor[doctorId]?.has(date) ?? false;

      const doctor = doctors.find((d) => d.id === doctorId);
      const hasShiftTypeConflict =
        doctor?.unavailableShiftTypes &&
        Array.isArray(doctor.unavailableShiftTypes)
          ? doctor.unavailableShiftTypes.includes(shift.shiftType as ShiftType)
          : false;

      const hasNightOverlap =
        shift.shiftType === "night" &&
        (["17shift", "20shift"] as ShiftType[]).some((type) => {
          const other = byType[type];
          return Array.isArray(other?.doctorIds)
            ? other?.doctorIds.includes(doctorId)
            : false;
        });

      return hasDateConflict || hasShiftTypeConflict || hasNightOverlap;
    },
    [doctors, unavailableByDoctor],
  );

  const hasShiftConflict = React.useCallback(
    (
      shift: Shift,
      date: string,
      byType: Partial<Record<ShiftType, Shift>>,
    ): boolean => {
      if (!Array.isArray(shift.doctorIds) || shift.doctorIds.length === 0)
        return false;
      return shift.doctorIds.some((doctorId) =>
        hasDoctorConflict(doctorId, shift, date, byType),
      );
    },
    [hasDoctorConflict],
  );

  return (
    <div className="max-w-xl mx-auto">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-1 py-1 w-[50px]" aria-label="Date" />
              {SHIFT_TYPES.map((t, index) => (
                <th
                  key={t}
                  className={cn(
                    "text-center py-1",
                    index === 0 ? "pl-1 pr-1" : "px-2",
                  )}
                >
                  {SHIFT_LABELS[t]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const isHoliday = HOLIDAY_DATE_SET_2026.has(key);
              const dayName = format(d, "EEEE", { locale: de });
              const dayPrefix = dayName.slice(0, 2);
              const byType = shiftIndex.get(key) || {};
              const rowConflict = SHIFT_TYPES.some((t) => {
                const s = byType[t];
                return s && hasShiftConflict(s, key, byType);
              });
              // Hide weekend-only shift content on weekdays
              const day = d.getDay();
              const isWeekend = day === 0 || day === 6;
              return (
                <tr
                  key={key}
                  className={cn(
                    "hover:bg-muted/30 cursor-pointer",
                    isWeekend && "bg-gray-100 dark:bg-gray-800",
                    rowConflict
                      ? "bg-red-100 dark:bg-red-900 hover:bg-red-200 border rounded border-red-400"
                      : undefined,
                  )}
                  onClick={() => onRowClick(d)}
                >
                  <td className="px-1 py-1 text-xs min-w-[50px]">
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
                  {SHIFT_TYPES.map((t, index) => {
                    const s = byType[t];
                    return (
                      <td
                        key={t}
                        className={cn(
                          "py-1 text-center",
                          index === 0 ? "pl-1 pr-1" : "px-2",
                          onCellClick && "cursor-pointer",
                        )}
                        onClick={(event) => {
                          if (!onCellClick) return;
                          event.stopPropagation();
                          onCellClick(d, t);
                        }}
                      >
                        {s ? (
                          s.doctorIds.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1 justify-center">
                              {s.doctors.map((assignedDoctor) => {
                                const conflict = hasDoctorConflict(
                                  assignedDoctor.id,
                                  s,
                                  key,
                                  byType,
                                );
                                return (
                                  <Pill
                                    key={`${assignedDoctor.id}-${s.id}`}
                                    color={assignedDoctor.color || undefined}
                                    showX={conflict}
                                    className={cn("text-xs justify-center")}
                                  >
                                    {assignedDoctor.name}
                                  </Pill>
                                );
                              })}
                            </div>
                          ) : (
                            "-"
                          )
                        ) : (
                          "-"
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
