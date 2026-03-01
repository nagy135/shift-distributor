"use client";

import { ClientOnly } from "@/components/client-only";
import { MonthlyShiftTable } from "@/components/shifts/MonthlyShiftTable";
import { DoctorShiftCounts } from "@/components/calendar/DoctorShiftCounts";
import type { Doctor, Shift } from "@/lib/api";
import type { ShiftType } from "@/lib/shifts";

type CalendarContentProps = {
  month: Date;
  shiftsLoading: boolean;
  doctors: Doctor[];
  allShifts: Shift[];
  unavailableByDoctor: Record<number, Set<string>>;
  onRowClick?: (date: Date) => void;
  onCellClick?: (date: Date, shiftType: ShiftType) => void;
};

export function CalendarContent({
  month,
  shiftsLoading,
  doctors,
  allShifts,
  unavailableByDoctor,
  onRowClick,
  onCellClick,
}: CalendarContentProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
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
              className="lg:w-56"
            />
          )}
        </ClientOnly>

        <ClientOnly
          fallback={
            <div className="rounded-md border mx-auto max-w-md p-4 text-center text-muted-foreground">
              Loading table...
            </div>
          }
        >
          {shiftsLoading ? (
            <div className="rounded-md border mx-auto max-w-md p-4 text-center text-muted-foreground">
              Loading shifts...
            </div>
          ) : (
            <MonthlyShiftTable
              month={month}
              shifts={allShifts}
              doctors={doctors}
              unavailableByDoctor={unavailableByDoctor}
              onRowClick={onRowClick}
              onCellClick={onCellClick}
            />
          )}
        </ClientOnly>
      </div>
    </div>
  );
}
