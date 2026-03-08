import { format, getDay } from "date-fns";
import { AUTO_DISTRIBUTE_SHIFT_TYPES, isWeekendOnly } from "@/lib/shifts";
import type { Shift } from "@/lib/api";

export type CalendarShiftTarget = {
  date: Date;
  shiftType: string;
};

export type CalendarCellClickOptions = {
  additive: boolean;
};

type ShiftLookupParams = {
  date?: Date;
  shiftType: string;
  allShifts: Shift[];
};

export function getShiftTargetKey({ date, shiftType }: CalendarShiftTarget) {
  return `${format(date, "yyyy-MM-dd")}|${shiftType}`;
}

export function getShiftForType({
  date,
  shiftType,
  allShifts,
}: ShiftLookupParams) {
  if (!date) return undefined;
  const dateStr = format(date, "yyyy-MM-dd");
  return allShifts.find(
    (shift) => shift.date === dateStr && shift.shiftType === shiftType,
  );
}

type UnassignedCheckParams = {
  date: Date;
  allShifts: Shift[];
};

export function isDayUnassigned({ date, allShifts }: UnassignedCheckParams) {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayShifts = allShifts.filter((shift) => shift.date === dateStr);
  const isWeekend = [0, 6].includes(getDay(date));

  const requiredTypes = AUTO_DISTRIBUTE_SHIFT_TYPES.filter(
    (type) => isWeekend || !isWeekendOnly(type),
  );

  for (const type of requiredTypes) {
    const shift = dayShifts.find((s) => s.shiftType === type);
    if (
      !shift ||
      !Array.isArray(shift.doctorIds) ||
      shift.doctorIds.length === 0
    ) {
      return true;
    }
  }

  return false;
}
