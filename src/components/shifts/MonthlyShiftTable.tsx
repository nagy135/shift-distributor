"use client";

import React from "react";
import {
  getShiftTargetKey,
  type CalendarCellClickOptions,
  type CalendarShiftTarget,
} from "@/components/calendar/utils";
import {
  QuickAssignOverlay,
  type QuickAssignOption,
} from "@/components/shifts/QuickAssignOverlay";
import type { Shift, Doctor } from "@/lib/api";
import {
  SHIFT_TABLE_COLUMNS,
  type CalendarShiftColumn,
  doesCalendarShiftUnavailableDateClash,
  isDayDutyShiftType,
  isShiftType,
} from "@/lib/shifts";
import { useDragToScroll } from "@/lib/use-drag-to-scroll";
import { cn } from "@/lib/utils";
import {
  getMonthTableDays,
  MonthlyTableBase,
} from "@/components/shifts/MonthlyTableBase";

interface MonthlyShiftTableProps {
  month: Date;
  shifts: Shift[];
  doctors: Doctor[];
  unavailableByDoctor?: Record<number, Set<string>>;
  approvedVacationsByDate?: Record<string, string[]>;
  columns?: readonly CalendarShiftColumn[];
  selectedTargets?: readonly CalendarShiftTarget[];
  selectedCellKeys?: ReadonlySet<string>;
  onRowClick?: (date: Date) => void;
  onCellClick?: (
    date: Date,
    shiftType: string,
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
  onQuickAssignOptionClick?: (value: string, additive: boolean) => void;
  onQuickAssignToggle?: (value: string) => void;
  onQuickAssignApply?: () => void;
  onQuickAssignClose?: () => void;
  onQuickAssignHighlightChange?: (index: number) => void;
  onQuickAssignShowAvailableOnlyChange?: (value: boolean) => void;
}

export function MonthlyShiftTable({
  month,
  shifts,
  doctors,
  unavailableByDoctor = {},
  approvedVacationsByDate = {},
  columns = SHIFT_TABLE_COLUMNS,
  selectedTargets = [],
  selectedCellKeys,
  onRowClick,
  onCellClick,
  onSelectionChange,
  onSelectionInteractionChange,
  quickAssignOpen = false,
  quickAssignFilterText = "",
  quickAssignHighlightedIndex = 0,
  quickAssignOptions = [],
  quickAssignSelectedValues = [],
  quickAssignShowAvailableOnly = false,
  onQuickAssignOptionClick,
  onQuickAssignToggle,
  onQuickAssignApply,
  onQuickAssignClose,
  onQuickAssignHighlightChange,
  onQuickAssignShowAvailableOnlyChange,
}: MonthlyShiftTableProps) {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const days = React.useMemo(() => getMonthTableDays(month), [month]);

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

  const doctorById = React.useMemo(() => {
    return new Map(doctors.map((doctor) => [doctor.id, doctor]));
  }, [doctors]);

  const activeColumnIds = React.useMemo(
    () => new Set(columns.map((column) => column.id)),
    [columns],
  );

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

        const doctor = doctorById.get(doctorId);
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
    [doctorById, unavailableByDoctor],
  );

  const hasShiftConflict = React.useCallback(
    (shift: Shift, date: string, byType: Record<string, Shift>): boolean => {
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
  const canChangeSelection = typeof onSelectionChange === "function";
  const { containerRef, isDragging, dragHandlers } =
    useDragToScroll<HTMLDivElement>();
  const dragSelectionRef = React.useRef<{
    anchorRowIndex: number;
    anchorColumnIndex: number;
    mode: "add" | "remove";
    baselineTargets: CalendarShiftTarget[];
  } | null>(null);
  const cellRefs = React.useRef(new Map<string, HTMLTableCellElement>());
  const suppressNextSelectionClickRef = React.useRef(false);
  const suppressSelectionClickTimeoutRef = React.useRef<number | null>(null);
  const [quickAssignPosition, setQuickAssignPosition] = React.useState<{
    top: number;
    left: number;
    minWidth: number;
  } | null>(null);

  const clearSuppressedSelectionClick = React.useCallback(() => {
    if (suppressSelectionClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressSelectionClickTimeoutRef.current);
      suppressSelectionClickTimeoutRef.current = null;
    }
    suppressNextSelectionClickRef.current = false;
  }, []);

  const buildSelectionTargets = React.useCallback(
    (
      baselineTargets: readonly CalendarShiftTarget[],
      mode: "add" | "remove",
      fromRowIndex: number,
      fromColumnIndex: number,
      toRowIndex: number,
      toColumnIndex: number,
    ) => {
      const nextTargets = new Map(
        baselineTargets.map((target) => [getShiftTargetKey(target), target]),
      );
      const startRow = Math.min(fromRowIndex, toRowIndex);
      const endRow = Math.max(fromRowIndex, toRowIndex);
      const startColumn = Math.min(fromColumnIndex, toColumnIndex);
      const endColumn = Math.max(fromColumnIndex, toColumnIndex);

      for (let row = startRow; row <= endRow; row += 1) {
        const date = days[row];

        for (let column = startColumn; column <= endColumn; column += 1) {
          const shiftType = columns[column]?.id;

          if (!date || !shiftType) {
            continue;
          }

          const target = { date, shiftType };
          const targetKey = getShiftTargetKey(target);

          if (mode === "add") {
            nextTargets.set(targetKey, target);
          } else {
            nextTargets.delete(targetKey);
          }
        }
      }

      return Array.from(nextTargets.values());
    },
    [columns, days],
  );

  const updateDragSelection = React.useCallback(
    (rowIndex: number, columnIndex: number) => {
      const dragSelection = dragSelectionRef.current;

      if (!dragSelection || !canChangeSelection) {
        return;
      }

      onSelectionChange(
        buildSelectionTargets(
          dragSelection.baselineTargets,
          dragSelection.mode,
          dragSelection.anchorRowIndex,
          dragSelection.anchorColumnIndex,
          rowIndex,
          columnIndex,
        ),
      );
    },
    [buildSelectionTargets, canChangeSelection, onSelectionChange],
  );

  const updateQuickAssignPosition = React.useCallback(() => {
    if (!quickAssignOpen || selectedTargets.length === 0) {
      setQuickAssignPosition(null);
      return;
    }

    const wrapper = wrapperRef.current;
    const anchorTarget = selectedTargets[selectedTargets.length - 1];
    const anchorKey = anchorTarget ? getShiftTargetKey(anchorTarget) : null;
    const anchorCell = anchorKey ? cellRefs.current.get(anchorKey) : null;

    if (!wrapper || !anchorCell) {
      setQuickAssignPosition(null);
      return;
    }

    const wrapperRect = wrapper.getBoundingClientRect();
    const anchorRect = anchorCell.getBoundingClientRect();

    setQuickAssignPosition({
      top: anchorRect.bottom - wrapperRect.top + 6,
      left: anchorRect.left - wrapperRect.left,
      minWidth: anchorRect.width,
    });
  }, [quickAssignOpen, selectedTargets]);

  const finishDragSelection = React.useCallback(() => {
    dragSelectionRef.current = null;
    clearSuppressedSelectionClick();
  }, [clearSuppressedSelectionClick]);

  React.useEffect(() => {
    const handleMouseUp = () => {
      dragSelectionRef.current = null;
      onSelectionInteractionChange?.(false);

      if (!suppressNextSelectionClickRef.current) {
        return;
      }

      if (suppressSelectionClickTimeoutRef.current !== null) {
        window.clearTimeout(suppressSelectionClickTimeoutRef.current);
      }

      suppressSelectionClickTimeoutRef.current = window.setTimeout(() => {
        suppressNextSelectionClickRef.current = false;
        suppressSelectionClickTimeoutRef.current = null;
      }, 0);
    };

    const handleWindowBlur = () => {
      onSelectionInteractionChange?.(false);
      finishDragSelection();
    };

    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("blur", handleWindowBlur);
      finishDragSelection();
    };
  }, [finishDragSelection, onSelectionInteractionChange]);

  React.useEffect(() => {
    updateQuickAssignPosition();

    if (!quickAssignOpen) {
      return;
    }

    const container = containerRef.current;

    window.addEventListener("resize", updateQuickAssignPosition);
    container?.addEventListener("scroll", updateQuickAssignPosition);

    return () => {
      window.removeEventListener("resize", updateQuickAssignPosition);
      container?.removeEventListener("scroll", updateQuickAssignPosition);
    };
  }, [containerRef, quickAssignOpen, updateQuickAssignPosition]);

  React.useEffect(() => {
    if (!canChangeSelection || selectedTargets.length === 0) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) {
        return;
      }

      onSelectionChange([]);
      onQuickAssignClose?.();
    };

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [
    canChangeSelection,
    onQuickAssignClose,
    onSelectionChange,
    selectedTargets.length,
  ]);

  return (
    <MonthlyTableBase
      month={month}
      wrapperRef={wrapperRef}
      containerRef={containerRef}
      containerClassName={cn(
        "cursor-move",
        isDragging && "cursor-grabbing",
      )}
      containerProps={dragHandlers}
      headerCells={
        <>
          {columns.map((column, index) => (
            <th
              key={column.id}
              className={cn(
                "py-1 text-center",
                index === 0
                  ? "pl-1 pr-1"
                  : "min-w-[120px] border-l border-gray-400 px-2",
              )}
            >
              <span className="flex flex-col items-center leading-tight">
                <span>{column.label}</span>
                {column.headerNote ? (
                  <span className="text-[10px] font-normal text-muted-foreground">
                    {column.headerNote}
                  </span>
                ) : null}
              </span>
            </th>
          ))}
          <th className="min-w-[140px] border-l border-gray-400 px-2 py-1 text-center">
            Urlaub
          </th>
        </>
      }
      getRowProps={({ date, dateKey }) => {
        const byType = shiftIndex.get(dateKey) ?? {};
        const visibleByType = Object.fromEntries(
          Object.entries(byType).filter(([shiftType]) => activeColumnIds.has(shiftType)),
        );
        const vacationDoctors = approvedVacationsByDate[dateKey] ?? [];
        const vacationDoctorIds = new Set<number>(
          vacationDoctors
            .map((doctorName) => doctorIdByName.get(doctorName))
            .filter(
              (doctorId): doctorId is number => typeof doctorId === "number",
            ),
        );
        const hasShiftConflictInRow = columns.some((column) => {
          const shift = visibleByType[column.id];
          return shift ? hasShiftConflict(shift, dateKey, visibleByType) : false;
        });
        const assignedDoctorIds = new Set<number>();
        columns.forEach((column) => {
          const shift = visibleByType[column.id];
          if (!shift || !Array.isArray(shift.doctorIds)) {
            return;
          }

          shift.doctorIds.forEach((doctorId) => {
            assignedDoctorIds.add(doctorId);
          });
        });
        const hasVacationConflict = Array.from(vacationDoctorIds).some((doctorId) =>
          assignedDoctorIds.has(doctorId),
        );
        const rowConflict = hasShiftConflictInRow || hasVacationConflict;

        return {
          className: rowConflict
            ? "rounded border border-red-400 bg-red-100 hover:bg-red-200 dark:border-red-500/70 dark:bg-red-800/40 dark:hover:bg-red-700/50"
            : undefined,
          onClick: (event) => {
            if (event.ctrlKey || event.metaKey) return;
            if (!canRowClick) return;
            onRowClick(date);
          },
        };
      }}
      getDateCellProps={() => ({
        className: (canRowClick || canCellClick) ? "hover:bg-muted/30" : undefined,
      })}
      renderCells={({ date, dateKey, rowIndex }) => {
        const byType = shiftIndex.get(dateKey) ?? {};
        const visibleByType = Object.fromEntries(
          Object.entries(byType).filter(([shiftType]) => activeColumnIds.has(shiftType)),
        );
        const vacationDoctors = approvedVacationsByDate[dateKey] ?? [];
        const vacationDoctorIds = new Set<number>(
          vacationDoctors
            .map((doctorName) => doctorIdByName.get(doctorName))
            .filter(
              (doctorId): doctorId is number => typeof doctorId === "number",
            ),
        );
        const assignedDoctorIds = new Set<number>();

        columns.forEach((column) => {
          const shift = visibleByType[column.id];
          if (!shift || !Array.isArray(shift.doctorIds)) {
            return;
          }

          shift.doctorIds.forEach((doctorId) => {
            assignedDoctorIds.add(doctorId);
          });
        });

        const hasVacationConflict = Array.from(vacationDoctorIds).some((doctorId) =>
          assignedDoctorIds.has(doctorId),
        );

        return (
          <>
            {columns.map((column, index) => {
              const shift = visibleByType[column.id];
              const cellTarget = {
                date,
                shiftType: column.id,
              };
              const cellKey = getShiftTargetKey(cellTarget);
              const isSelectedCell = selectedCellKeys?.has(cellKey) ?? false;
              const hasShiftCellConflict = shift
                ? hasShiftConflict(shift, dateKey, visibleByType)
                : false;
              const hasVacationCellConflict =
                !!shift &&
                Array.isArray(shift.doctorIds) &&
                shift.doctorIds.some((doctorId) => vacationDoctorIds.has(doctorId));
              const cellConflict = hasShiftCellConflict || hasVacationCellConflict;

              return (
                <td
                  key={column.id}
                  ref={(node) => {
                    if (node) {
                      cellRefs.current.set(cellKey, node);
                    } else {
                      cellRefs.current.delete(cellKey);
                    }
                  }}
                  className={cn(
                    "py-1 text-center",
                    index === 0
                      ? "pl-1 pr-1"
                      : "min-w-[120px] border-l border-gray-400 px-2",
                    cellConflict &&
                      "bg-red-300 hover:bg-red-300 dark:bg-red-700/80 dark:hover:bg-red-700/80",
                    isSelectedCell &&
                      "outline-2 outline-offset-[-2px] outline-solid outline-sky-500 bg-sky-100 dark:bg-sky-950/60",
                    !cellConflict &&
                      (canRowClick || canCellClick) &&
                      "hover:bg-muted/30",
                  )}
                  onMouseDown={(event) => {
                    if (event.ctrlKey || event.metaKey) {
                      event.preventDefault();
                      event.stopPropagation();

                      if (!canChangeSelection || event.button !== 0) {
                        return;
                      }

                      onSelectionInteractionChange?.(true);

                      clearSuppressedSelectionClick();

                      const selectionMode = isSelectedCell ? "remove" : "add";

                      dragSelectionRef.current = {
                        anchorRowIndex: rowIndex,
                        anchorColumnIndex: index,
                        mode: selectionMode,
                        baselineTargets: [...selectedTargets],
                      };
                      suppressNextSelectionClickRef.current = true;
                      updateDragSelection(rowIndex, index);
                    }
                  }}
                  onMouseEnter={(event) => {
                    if ((event.buttons & 1) !== 1) {
                      return;
                    }

                    if (!dragSelectionRef.current) {
                      return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    updateDragSelection(rowIndex, index);
                  }}
                  onContextMenu={(event) => {
                    if (event.ctrlKey || event.metaKey) {
                      event.preventDefault();
                    }
                  }}
                  onClick={(event) => {
                    if (!canCellClick) return;

                    if (suppressNextSelectionClickRef.current) {
                      clearSuppressedSelectionClick();
                      event.preventDefault();
                      event.stopPropagation();
                      return;
                    }

                    event.stopPropagation();
                    onCellClick(date, column.id, {
                      additive: event.ctrlKey || event.metaKey,
                    });
                  }}
                >
                  {shift ? (
                    shift.doctorIds.length > 0 ? (
                      <span>
                        {shift.doctors
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
                "min-w-[140px] border-l border-gray-400 px-2 py-1 text-center",
                hasVacationConflict &&
                  "bg-red-300 hover:bg-red-300 dark:bg-red-700/80 dark:hover:bg-red-700/80",
                !hasVacationConflict &&
                  (canRowClick || canCellClick) &&
                  "hover:bg-muted/30",
              )}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              {vacationDoctors.length > 0 ? vacationDoctors.join("/") : "-"}
            </td>
          </>
        );
      }}
    >
      <QuickAssignOverlay
        open={quickAssignOpen}
        position={quickAssignPosition}
        options={quickAssignOptions}
        filterText={quickAssignFilterText}
        highlightedIndex={quickAssignHighlightedIndex}
        selectedValues={quickAssignSelectedValues}
        showAvailableOnly={quickAssignShowAvailableOnly}
        onOptionClick={(value, additive) =>
          onQuickAssignOptionClick?.(value, additive)
        }
        onToggleSelect={(value) => onQuickAssignToggle?.(value)}
        onApply={() => onQuickAssignApply?.()}
        onClose={() => onQuickAssignClose?.()}
        onHighlightChange={(index) => onQuickAssignHighlightChange?.(index)}
        onShowAvailableOnlyChange={(value) =>
          onQuickAssignShowAvailableOnlyChange?.(value)
        }
      />
    </MonthlyTableBase>
  );
}
