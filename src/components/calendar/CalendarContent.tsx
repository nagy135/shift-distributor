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
  approvedVacationsByDate: Record<string, string[]>;
  onRowClick?: (date: Date) => void;
  onCellClick?: (date: Date, shiftType: ShiftType) => void;
};

export function CalendarContent({
  month,
  shiftsLoading,
  doctors,
  allShifts,
  unavailableByDoctor,
  approvedVacationsByDate,
  onRowClick,
  onCellClick,
}: CalendarContentProps) {
  const statisticsContent = (
    <ClientOnly
      fallback={
        <div className="rounded-md border mx-auto max-w-md p-4 text-center text-muted-foreground">
          Diensteinträge werden geladen...
        </div>
      }
    >
      {shiftsLoading ? (
        <div className="rounded-md border mx-auto max-w-md p-4 text-center text-muted-foreground">
          Dienste werden geladen...
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
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        <details className="rounded-md border md:hidden">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
            Statistik
          </summary>
          <div className="p-3 pt-0">{statisticsContent}</div>
        </details>

        <div className="hidden md:block">{statisticsContent}</div>

        <ClientOnly
          fallback={
            <div className="rounded-md border mx-auto max-w-md p-4 text-center text-muted-foreground">
              Tabelle wird geladen...
            </div>
          }
        >
          {shiftsLoading ? (
            <div className="rounded-md border mx-auto max-w-md p-4 text-center text-muted-foreground">
               Dienste werden geladen...
            </div>
          ) : (
            <MonthlyShiftTable
              month={month}
              shifts={allShifts}
              doctors={doctors}
              unavailableByDoctor={unavailableByDoctor}
              approvedVacationsByDate={approvedVacationsByDate}
              onRowClick={onRowClick}
              onCellClick={onCellClick}
            />
          )}
        </ClientOnly>
      </div>
    </div>
  );
}
