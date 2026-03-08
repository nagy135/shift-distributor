"use client";

import React from "react";
import { ClientOnly } from "@/components/client-only";
import { Button } from "@/components/ui/button";
import { MonthlyShiftTable } from "@/components/shifts/MonthlyShiftTable";
import { DoctorShiftCounts } from "@/components/calendar/DoctorShiftCounts";
import type { Doctor, Shift } from "@/lib/api";
import {
  DEPARTMENT_SHIFT_COLUMNS,
  DEPARTMENT_SHIFT_TYPES,
  SHIFT_TABLE_COLUMNS,
  SHIFT_TYPES,
} from "@/lib/shifts";

type CalendarTableView = "shifts" | "departments";

type CalendarContentProps = {
  month: Date;
  shiftsLoading: boolean;
  doctors: Doctor[];
  allShifts: Shift[];
  unavailableByDoctor: Record<number, Set<string>>;
  approvedVacationsByDate: Record<string, string[]>;
  onRowClick?: (date: Date, shiftTypes: readonly string[]) => void;
  onCellClick?: (
    date: Date,
    shiftType: string,
    shiftTypes: readonly string[],
  ) => void;
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
  const [tableView, setTableView] = React.useState<CalendarTableView>("shifts");

  const activeColumns =
    tableView === "shifts" ? SHIFT_TABLE_COLUMNS : DEPARTMENT_SHIFT_COLUMNS;
  const activeShiftTypes =
    tableView === "shifts" ? SHIFT_TYPES : DEPARTMENT_SHIFT_TYPES;

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
          className="lg:max-w-md"
        />
      )}
    </ClientOnly>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-center">
        <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-md border p-1">
          <Button
            type="button"
            size="sm"
            variant={tableView === "shifts" ? "default" : "outline"}
            onClick={() => setTableView("shifts")}
          >
            Dienste
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tableView === "departments" ? "default" : "outline"}
            onClick={() => setTableView("departments")}
          >
            Abteilungen
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        <details className="rounded-md border md:hidden">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
            Statistik
          </summary>
          <div className="p-3 pt-0">{statisticsContent}</div>
        </details>

        <div className="hidden md:block">{statisticsContent}</div>

        <div className="min-w-0 flex-1">
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
                columns={activeColumns}
                onRowClick={
                  onRowClick
                    ? (date) => onRowClick(date, activeShiftTypes)
                    : undefined
                }
                onCellClick={
                  onCellClick
                    ? (date, shiftType) =>
                        onCellClick(date, shiftType, activeShiftTypes)
                    : undefined
                }
              />
            )}
          </ClientOnly>
        </div>
      </div>
    </div>
  );
}
