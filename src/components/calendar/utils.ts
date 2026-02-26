import { format, getDay } from "date-fns";
import { SHIFT_TYPES, isWeekendOnly } from "@/lib/shifts";
import type { Shift } from "@/lib/api";

type ShiftLookupParams = {
  selectedDate?: Date;
  shiftType: string;
  allShifts: Shift[];
};

export function getShiftForType({
  selectedDate,
  shiftType,
  allShifts,
}: ShiftLookupParams) {
  if (!selectedDate) return undefined;
  const dateStr = format(selectedDate, "yyyy-MM-dd");
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

  const requiredTypes = SHIFT_TYPES.filter(
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
