"use client";

import React from "react";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ClientOnly } from "@/components/client-only";
import { Button } from "@/components/ui/button";
import type {
  CalendarCellClickOptions,
  CalendarShiftTarget,
} from "@/components/calendar/utils";
import { MonthlyShiftTable } from "@/components/shifts/MonthlyShiftTable";
import type { QuickAssignOption } from "@/components/shifts/QuickAssignOverlay";
import { DoctorShiftCounts } from "@/components/calendar/DoctorShiftCounts";
import type { Doctor, Shift } from "@/lib/api";
import {
  DEPARTMENT_SHIFT_COLUMNS,
  DEPARTMENT_SHIFT_TYPES,
  SHIFT_TABLE_COLUMNS,
  SHIFT_TYPES,
} from "@/lib/shifts";

export type CalendarTableView = "shifts" | "departments";

type CalendarContentProps = {
  month: Date;
  tableView: CalendarTableView;
  onTableViewChange: (view: CalendarTableView) => void;
  shiftsLoading: boolean;
  doctors: Doctor[];
  allShifts: Shift[];
  unavailableByDoctor: Record<number, Set<string>>;
  approvedVacationsByDate: Record<string, string[]>;
  manualApprovedVacationsByDate: Record<string, string[]>;
  automaticNightVacationsByDate: Record<string, string[]>;
  selectedTargets?: readonly CalendarShiftTarget[];
  selectedCellKeys?: ReadonlySet<string>;
  onRowClick?: (date: Date, shiftTypes: readonly string[]) => void;
  onCellClick?: (
    date: Date,
    shiftType: string,
    shiftTypes: readonly string[],
    options: CalendarCellClickOptions,
  ) => void;
  onSelectionChange?: (targets: CalendarShiftTarget[]) => void;
  onSelectionInteractionChange?: (active: boolean) => void;
  quickAssignOpen?: boolean;
  quickAssignFilterText?: string;
  quickAssignHighlightedIndex?: number;
  quickAssignOptions?: readonly QuickAssignOption[];
  quickAssignSelectedValues?: readonly string[];
  quickAssignShowAvailableOnly?: boolean;
  quickAssignShowOaDoctors?: boolean;
  quickAssignCanShowOaDoctors?: boolean;
  onQuickAssignOptionClick?: (value: string, additive: boolean) => void;
  onQuickAssignToggle?: (value: string) => void;
  onQuickAssignClose?: () => void;
  onQuickAssignHighlightChange?: (index: number) => void;
  onQuickAssignShowAvailableOnlyChange?: (value: boolean) => void;
  onQuickAssignShowOaDoctorsChange?: (value: boolean) => void;
};

export function CalendarContent({
  month,
  tableView,
  onTableViewChange,
  shiftsLoading,
  doctors,
  allShifts,
  unavailableByDoctor,
  approvedVacationsByDate,
  manualApprovedVacationsByDate,
  automaticNightVacationsByDate,
  selectedTargets,
  selectedCellKeys,
  onRowClick,
  onCellClick,
  onSelectionChange,
  onSelectionInteractionChange,
  quickAssignOpen,
  quickAssignFilterText,
  quickAssignHighlightedIndex,
  quickAssignOptions,
  quickAssignSelectedValues,
  quickAssignShowAvailableOnly,
  quickAssignShowOaDoctors,
  quickAssignCanShowOaDoctors,
  onQuickAssignOptionClick,
  onQuickAssignToggle,
  onQuickAssignClose,
  onQuickAssignHighlightChange,
  onQuickAssignShowAvailableOnlyChange,
  onQuickAssignShowOaDoctorsChange,
}: CalendarContentProps) {
  const [statisticsVisible, setStatisticsVisible] = React.useState(false);

  const activeColumns =
    tableView === "shifts" ? SHIFT_TABLE_COLUMNS : DEPARTMENT_SHIFT_COLUMNS;
  const activeShiftTypes =
    tableView === "shifts" ? SHIFT_TYPES : DEPARTMENT_SHIFT_TYPES;
  const selectableColumnIds = React.useMemo(
    () => new Set(activeShiftTypes),
    [activeShiftTypes],
  );

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
          columns={activeColumns}
          view={tableView}
          className={
            tableView === "shifts"
              ? "w-full lg:max-w-md"
              : "w-full lg:max-w-[32rem]"
          }
        />
      )}
    </ClientOnly>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-center">
        <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-md p-1">
          <Button
            type="button"
            size="sm"
            variant={tableView === "shifts" ? "default" : "outline"}
            onClick={() => onTableViewChange("shifts")}
          >
            <CalendarDays className="size-4" />
            Dienste
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tableView === "departments" ? "default" : "outline"}
            onClick={() => onTableViewChange("departments")}
          >
            <Building2 className="size-4" />
            Station
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        <details className="group overflow-hidden rounded-xl border bg-card shadow-sm md:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-1.5 select-none [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-none">Statistik</p>
            </div>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground transition-transform duration-200 group-open:rotate-180">
              <ChevronDown className="size-4" />
            </span>
          </summary>
          <div className="p-3 pt-0">{statisticsContent}</div>
        </details>

        <div className="hidden md:flex md:items-start md:gap-3">
          <div
            className={[
              "grid transition-[grid-template-columns,opacity,margin] duration-500 ease-in-out",
              statisticsVisible
                ? "mr-0 grid-cols-[minmax(0,1fr)] opacity-100"
                : "mr-[-0.75rem] grid-cols-[0fr] opacity-0",
            ].join(" ")}
          >
            <div className="min-w-0 overflow-hidden">
              <div className="min-w-0 shrink-0">{statisticsContent}</div>
            </div>
          </div>

          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8 shrink-0 transition-all duration-500 ease-in-out"
            onClick={() => setStatisticsVisible((current) => !current)}
            aria-label={
              statisticsVisible
                ? "Statistik ausblenden"
                : "Statistik einblenden"
            }
            title={
              statisticsVisible
                ? "Statistik ausblenden"
                : "Statistik einblenden"
            }
          >
            {statisticsVisible ? (
              <ChevronLeft className="size-4 transition-transform duration-500 ease-in-out" />
            ) : (
              <ChevronRight className="size-4 transition-transform duration-500 ease-in-out" />
            )}
          </Button>
        </div>

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
                considerUnavailableDates={tableView === "shifts"}
                approvedVacationsByDate={approvedVacationsByDate}
                vacationColumnByDate={
                  tableView === "departments"
                    ? manualApprovedVacationsByDate
                    : approvedVacationsByDate
                }
                automaticNightVacationsByDate={automaticNightVacationsByDate}
                columns={activeColumns}
                selectableColumnIds={selectableColumnIds}
                disableWeekendSelection={tableView === "departments"}
                selectedTargets={selectedTargets}
                selectedCellKeys={selectedCellKeys}
                onRowClick={
                  onRowClick
                    ? (date) => onRowClick(date, activeShiftTypes)
                    : undefined
                }
                onCellClick={
                  onCellClick
                    ? (date, shiftType, options) =>
                        onCellClick(date, shiftType, activeShiftTypes, options)
                    : undefined
                }
                onSelectionChange={onSelectionChange}
                onSelectionInteractionChange={onSelectionInteractionChange}
                quickAssignOpen={quickAssignOpen}
                quickAssignFilterText={quickAssignFilterText}
                quickAssignHighlightedIndex={quickAssignHighlightedIndex}
                quickAssignOptions={quickAssignOptions}
                quickAssignSelectedValues={quickAssignSelectedValues}
                quickAssignShowAvailableOnly={quickAssignShowAvailableOnly}
                quickAssignShowOaDoctors={quickAssignShowOaDoctors}
                quickAssignCanShowOaDoctors={quickAssignCanShowOaDoctors}
                onQuickAssignOptionClick={onQuickAssignOptionClick}
                onQuickAssignToggle={onQuickAssignToggle}
                onQuickAssignClose={onQuickAssignClose}
                onQuickAssignHighlightChange={onQuickAssignHighlightChange}
                onQuickAssignShowAvailableOnlyChange={
                  onQuickAssignShowAvailableOnlyChange
                }
                onQuickAssignShowOaDoctorsChange={onQuickAssignShowOaDoctorsChange}
              />
            )}
          </ClientOnly>
        </div>
      </div>
    </div>
  );
}
