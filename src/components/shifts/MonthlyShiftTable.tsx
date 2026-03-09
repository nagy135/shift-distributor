"use client";

import React from "react";
import { eachDayOfInterval, endOfMonth, format, startOfMonth } from "date-fns";
import { de } from "date-fns/locale";
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
import { HOLIDAY_DATE_SET_2026 } from "@/lib/holidays";

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
  onQuickAssignOptionClick?: (value: string, additive: boolean) => void;
  onQuickAssignToggle?: (value: string) => void;
  onQuickAssignApply?: () => void;
  onQuickAssignClose?: () => void;
  onQuickAssignHighlightChange?: (index: number) => void;
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
  onQuickAssignOptionClick,
  onQuickAssignToggle,
  onQuickAssignApply,
  onQuickAssignClose,
  onQuickAssignHighlightChange,
}: MonthlyShiftTableProps) {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
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
    <div ref={wrapperRef} className="relative w-full">
      <div
        ref={containerRef}
        className={cn(
          "max-w-full overflow-auto rounded-md border cursor-move select-none",
          isDragging && "cursor-grabbing",
        )}
        {...dragHandlers}
      >
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
            {days.map((d, rowIndex) => {
              const key = format(d, "yyyy-MM-dd");
              const isHoliday = HOLIDAY_DATE_SET_2026.has(key);
              const dayName = format(d, "EEEE", { locale: de });
              const dayPrefix = dayName.slice(0, 2);
              const byType = shiftIndex.get(key) ?? {};
              const visibleByType = Object.fromEntries(
                Object.entries(byType).filter(([shiftType]) =>
                  activeColumnIds.has(shiftType),
                ),
              );
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
                const s = visibleByType[column.id];
                return s && hasShiftConflict(s, key, visibleByType);
              });
              const assignedDoctorIds = new Set<number>();
              columns.forEach((column) => {
                const s = visibleByType[column.id];
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
                    // canRowClick && "cursor-pointer",
                    // !canRowClick && "cursor-default",
                    (isWeekend || isHoliday) && "bg-gray-200 dark:bg-gray-700",
                    rowConflict
                      ? "bg-red-100 dark:bg-red-800/40 hover:bg-red-200 dark:hover:bg-red-700/50 border rounded border-red-400 dark:border-red-500/70"
                      : undefined,
                  )}
                  onClick={(event) => {
                    if (event.ctrlKey || event.metaKey) return;
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
                    const s = visibleByType[column.id];
                    const cellTarget = {
                      date: d,
                      shiftType: column.id,
                    };
                    const cellKey = getShiftTargetKey(cellTarget);
                    const isSelectedCell =
                      selectedCellKeys?.has(cellKey) ?? false;
                    const hasShiftCellConflict = s
                      ? hasShiftConflict(s, key, visibleByType)
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
                            : "px-2 min-w-[120px] border-l border-gray-400",
                          // canCellClick && "cursor-pointer",
                          cellConflict &&
                            "bg-red-300 dark:bg-red-700/80 hover:bg-red-300 dark:hover:bg-red-700/80",
                          isSelectedCell &&
                            "outline-2 outline-sky-500 outline-solid outline-offset-[-2px] bg-sky-100 dark:bg-sky-950/60",
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

                            const selectionMode = isSelectedCell
                              ? "remove"
                              : "add";

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
                          onCellClick(d, column.id, {
                            additive: event.ctrlKey || event.metaKey,
                          });
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

      <QuickAssignOverlay
        open={quickAssignOpen}
        position={quickAssignPosition}
        options={quickAssignOptions}
        filterText={quickAssignFilterText}
        highlightedIndex={quickAssignHighlightedIndex}
        selectedValues={quickAssignSelectedValues}
        onOptionClick={(value, additive) =>
          onQuickAssignOptionClick?.(value, additive)
        }
        onToggleSelect={(value) => onQuickAssignToggle?.(value)}
        onApply={() => onQuickAssignApply?.()}
        onClose={() => onQuickAssignClose?.()}
        onHighlightChange={(index) => onQuickAssignHighlightChange?.(index)}
      />
    </div>
  );
}
