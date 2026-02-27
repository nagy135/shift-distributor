"use client";

import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { ClientOnly } from "@/components/client-only";
import { MonthlyShiftTable } from "@/components/shifts/MonthlyShiftTable";
import { DoctorShiftCounts } from "@/components/calendar/DoctorShiftCounts";
import type { Doctor, Shift } from "@/lib/api";
import type { ShiftType } from "@/lib/shifts";

type CalendarContentProps = {
  month: Date;
  setMonth: (month: Date) => void;
  selectedDate: Date | undefined;
  onSelectDate: (date: Date | undefined) => void;
  useTableView: boolean;
  shiftsLoading: boolean;
  doctors: Doctor[];
  allShifts: Shift[];
  unavailableByDoctor: Record<number, Set<string>>;
  onRowClick: (date: Date) => void;
  onCellClick?: (date: Date, shiftType: ShiftType) => void;
  isUnassignedDay: (date: Date) => boolean;
};

export function CalendarContent({
  month,
  setMonth,
  selectedDate,
  onSelectDate,
  useTableView,
  shiftsLoading,
  doctors,
  allShifts,
  unavailableByDoctor,
  onRowClick,
  onCellClick,
  isUnassignedDay,
}: CalendarContentProps) {
  return (
    <div className="space-y-6">
      <ClientOnly
        fallback={
          <div className="rounded-md border mx-auto max-w-md p-4 text-center text-muted-foreground">
            Loading shift counts...
          </div>
        }
      >
        {shiftsLoading ? (
          <div className="rounded-md border mx-auto max-w-md p-4 text-center text-muted-foreground">
            Loading shifts...
          </div>
        ) : (
          <DoctorShiftCounts
            doctors={doctors}
            shifts={allShifts}
            month={month}
          />
        )}
      </ClientOnly>

      <ClientOnly
        fallback={
          <div className="rounded-md border mx-auto max-w-md p-4 text-center text-muted-foreground">
            Loading calendar...
          </div>
        }
      >
        {shiftsLoading ? (
          <div className="rounded-md border mx-auto max-w-md p-4 text-center text-muted-foreground">
            Loading shifts...
          </div>
        ) : useTableView ? (
          <MonthlyShiftTable
            month={month}
            shifts={allShifts}
            doctors={doctors}
            unavailableByDoctor={unavailableByDoctor}
            onRowClick={onRowClick}
            onCellClick={onCellClick}
          />
        ) : (
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={onSelectDate}
            month={month}
            onMonthChange={setMonth}
            className="rounded-md border mx-auto max-w-md"
            showOutsideDays={false}
            modifiers={{
              unassigned: (date) => isUnassignedDay(date),
            }}
            modifiersClassNames={{
              unassigned:
                "bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/20 dark:text-orange-400",
            }}
            locale={enUS}
            formatters={{
              formatDay: (date) => format(date, "d"),
            }}
          />
        )}
      </ClientOnly>
    </div>
  );
}
