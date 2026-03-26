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
import { cn } from "@/lib/utils";
import {
  getMonthTableDays,
  MonthlyTableBase,
} from "@/components/shifts/MonthlyTableBase";
import { HOLIDAY_DAY_SET } from "@/lib/holidays";
import { NIGHT_FREE_COLUMN_ID } from "@/lib/night-shift-vacations";

interface MonthlyShiftTableProps {
  month: Date;
  shifts: Shift[];
  doctors: Doctor[];
  unavailableByDoctor?: Record<number, Set<string>>;
  considerUnavailableDates?: boolean;
  approvedVacationsByDate?: Record<string, string[]>;
  vacationColumnByDate?: Record<string, string[]>;
  automaticNightVacationsByDate?: Record<string, string[]>;
  columns?: readonly CalendarShiftColumn[];
  selectableColumnIds?: ReadonlySet<string>;
  disableWeekendSelection?: boolean;
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
  onQuickAssignClose?: () => void;
  onQuickAssignHighlightChange?: (index: number) => void;
  onQuickAssignShowAvailableOnlyChange?: (value: boolean) => void;
}

export function MonthlyShiftTable({
  month,
  shifts,
  doctors,
  unavailableByDoctor = {},
  considerUnavailableDates = true,
  approvedVacationsByDate = {},
  vacationColumnByDate = approvedVacationsByDate,
  automaticNightVacationsByDate = {},
  columns = SHIFT_TABLE_COLUMNS,
  selectableColumnIds,
  disableWeekendSelection = false,
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
  const interactiveColumnIds = React.useMemo(
    () => selectableColumnIds ?? activeColumnIds,
    [activeColumnIds, selectableColumnIds],
  );

  // Helper function to check if a shift assignment violates constraints
  const hasDoctorConflict = React.useCallback(
    (
      doctorId: number,
      shift: Shift,
      date: string,
      byType: Record<string, Shift>,
    ): boolean => {
      const hasDateConflict =
        considerUnavailableDates &&
        doesCalendarShiftUnavailableDateClash(shift.shiftType)
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
    [considerUnavailableDates, doctorById, unavailableByDoctor],
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
  const isInteractive = canRowClick || canCellClick;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const dragSelectionRef = React.useRef<{
    anchorRowIndex: number;
    anchorColumnIndex: number;
    hasMoved: boolean;
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

  const isSelectionDisabledForDate = React.useCallback(
    (date: Date) => {
      if (!disableWeekendSelection) {
        return false;
      }

      const dayKey = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      return [0, 6].includes(date.getDay()) || HOLIDAY_DAY_SET.has(dayKey);
    },
    [disableWeekendSelection],
  );

  const isSelectionDisabledForCell = React.useCallback(
    (date: Date, shiftType: string) => {
      if (shiftType === "night") {
        return false;
      }

      return isSelectionDisabledForDate(date);
    },
    [isSelectionDisabledForDate],
  );

  const buildSelectionTargets = React.useCallback(
    (
      fromRowIndex: number,
      fromColumnIndex: number,
      toRowIndex: number,
    ) => {
      const nextTargets: CalendarShiftTarget[] = [];
      const startRow = Math.min(fromRowIndex, toRowIndex);
      const endRow = Math.max(fromRowIndex, toRowIndex);
      const shiftType = columns[fromColumnIndex]?.id;

      if (!shiftType || !interactiveColumnIds.has(shiftType)) {
        return nextTargets;
      }

      for (let row = startRow; row <= endRow; row += 1) {
        const date = days[row];

        if (!date) {
          continue;
        }

        if (isSelectionDisabledForCell(date, shiftType)) {
          continue;
        }

        nextTargets.push({ date, shiftType });
      }

      return nextTargets;
    },
    [columns, days, interactiveColumnIds, isSelectionDisabledForCell],
  );

  const updateDragSelection = React.useCallback(
    (rowIndex: number) => {
      const dragSelection = dragSelectionRef.current;

      if (!dragSelection || !canChangeSelection) {
        return;
      }

      dragSelection.hasMoved = true;

      onSelectionChange(
        buildSelectionTargets(
          dragSelection.anchorRowIndex,
          dragSelection.anchorColumnIndex,
          rowIndex,
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

  React.useEffect(() => {
    if (!canChangeSelection || selectedTargets.length === 0) {
      return;
    }

    const selectableTargets = selectedTargets.filter(
      (target) =>
        !isSelectionDisabledForCell(target.date, target.shiftType) &&
        interactiveColumnIds.has(target.shiftType),
    );

    if (selectableTargets.length === selectedTargets.length) {
      return;
    }

    onSelectionChange(selectableTargets);
  }, [
    canChangeSelection,
    interactiveColumnIds,
    isSelectionDisabledForCell,
    onSelectionChange,
    selectedTargets,
  ]);

  const getRowState = React.useCallback(
    (dateKey: string) => {
      const byType = shiftIndex.get(dateKey) ?? {};
      const visibleByType: Record<string, Shift> = {};

      Object.entries(byType).forEach(([shiftType, shift]) => {
        if (activeColumnIds.has(shiftType)) {
          visibleByType[shiftType] = shift;
        }
      });

      const vacationDoctors = vacationColumnByDate[dateKey] ?? [];
      const conflictVacationDoctors = approvedVacationsByDate[dateKey] ?? [];
      const automaticNightVacationDoctors =
          automaticNightVacationsByDate[dateKey] ?? [];
      const vacationDoctorIds = new Set<number>(
        conflictVacationDoctors
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

      const hasShiftConflictInRow = columns.some((column) => {
        const shift = visibleByType[column.id];
        return shift ? hasShiftConflict(shift, dateKey, visibleByType) : false;
      });
      const hasVacationConflict = Array.from(vacationDoctorIds).some(
        (doctorId) => assignedDoctorIds.has(doctorId),
      );

        return {
          visibleByType,
          vacationDoctors,
          automaticNightVacationDoctors,
          vacationDoctorIds,
          hasVacationConflict,
          rowConflict: hasShiftConflictInRow || hasVacationConflict,
      };
    },
    [
      activeColumnIds,
      approvedVacationsByDate,
      automaticNightVacationsByDate,
      columns,
      doctorIdByName,
      hasShiftConflict,
      shiftIndex,
      vacationColumnByDate,
    ],
  );

  const getContentCellStateClassName = React.useCallback(
    ({
      isConflict = false,
      isSelected = false,
      isDisabled = false,
      isWeekendOrHoliday = false,
    }: {
      isConflict?: boolean;
      isSelected?: boolean;
      isDisabled?: boolean;
      isWeekendOrHoliday?: boolean;
    }) => {
      if (isSelected) {
        return cn(
          "outline-2 outline-offset-[-2px] outline-solid outline-sky-500 bg-sky-100 dark:bg-sky-950/60",
          isInteractive && !isDisabled && "cursor-cell hover:bg-sky-200 dark:hover:bg-sky-900/80",
        );
      }

      if (isConflict) {
        return cn(
          "bg-red-300 dark:bg-red-700/80",
          isInteractive && !isDisabled && "cursor-cell hover:bg-red-400 dark:hover:bg-red-700",
        );
      }

      if (isWeekendOrHoliday) {
        return cn(
          "bg-gray-200 dark:bg-gray-700",
          isInteractive && !isDisabled && "cursor-cell hover:bg-gray-300 dark:hover:bg-gray-600",
        );
      }

      return isInteractive && !isDisabled
        ? "cursor-cell bg-white hover:bg-gray-100 dark:bg-background dark:hover:bg-muted/60"
        : undefined;
    },
    [isInteractive],
  );

  const getDateCellStateClassName = React.useCallback(
    ({
      isConflict = false,
      isDisabled = false,
      isWeekendOrHoliday = false,
    }: {
      isConflict?: boolean;
      isDisabled?: boolean;
      isWeekendOrHoliday?: boolean;
    }) => {
      if (isConflict) {
        return cn(
          "bg-red-100 dark:bg-red-800/40",
          isInteractive && !isDisabled && "cursor-cell hover:bg-red-200 dark:hover:bg-red-700/50",
        );
      }

      if (isWeekendOrHoliday) {
        return cn(
          "bg-gray-200 dark:bg-gray-700",
          isInteractive && !isDisabled && "cursor-cell hover:bg-gray-300 dark:hover:bg-gray-600",
        );
      }

      return isInteractive && !isDisabled
        ? "cursor-cell bg-white hover:bg-gray-100 dark:bg-background dark:hover:bg-muted/60"
        : undefined;
    },
    [isInteractive],
  );

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
      getRowProps={({ date, isHoliday, isWeekend }) => {
        const isRowClickDisabled = disableWeekendSelection && (isWeekend || isHoliday);

        return {
          onClick: () => {
            if (isRowClickDisabled) return;
            if (!canRowClick) return;
            onRowClick(date);
          },
        };
      }}
      getDateCellProps={({ dateKey, isHoliday, isWeekend }) => {
        const { rowConflict } = getRowState(dateKey);
        const isSelectionDisabled = disableWeekendSelection && (isWeekend || isHoliday);

        return {
          className: getDateCellStateClassName({
            isConflict: rowConflict,
            isDisabled: isSelectionDisabled,
            isWeekendOrHoliday: isHoliday || isWeekend,
          }),
        };
      }}
      renderCells={({ date, dateKey, rowIndex, isHoliday, isWeekend }) => {
        const {
          visibleByType,
          vacationDoctors,
          automaticNightVacationDoctors,
          vacationDoctorIds,
          hasVacationConflict,
        } = getRowState(dateKey);
        const isWeekendOrHoliday = isHoliday || isWeekend;

        return (
          <>
            {columns.map((column, index) => {
              const shift = visibleByType[column.id];
              const cellTarget = {
                date,
                shiftType: column.id,
              };
              const cellKey = getShiftTargetKey(cellTarget);
              const isInteractiveColumn = interactiveColumnIds.has(column.id);
              const isSelectionDisabled = isSelectionDisabledForCell(
                date,
                column.id,
              );
              const isSelectedCell = selectedCellKeys?.has(cellKey) ?? false;
              const hasShiftCellConflict = shift
                ? hasShiftConflict(shift, dateKey, visibleByType)
                : false;
              const hasVacationCellConflict =
                !!shift &&
                Array.isArray(shift.doctorIds) &&
                shift.doctorIds.some((doctorId) =>
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
                      : "min-w-[120px] border-l border-gray-400 px-2",
                    getContentCellStateClassName({
                      isConflict: cellConflict,
                      isDisabled: isSelectionDisabled,
                      isSelected: isSelectedCell,
                      isWeekendOrHoliday,
                    }),
                  )}
                  onMouseDown={(event) => {
                    if (isSelectionDisabled) {
                      return;
                    }

                    if (!isInteractiveColumn) {
                      return;
                    }

                    if (!canChangeSelection || event.button !== 0) {
                      return;
                    }

                    event.preventDefault();
                    event.stopPropagation();

                    clearSuppressedSelectionClick();

                    dragSelectionRef.current = {
                      anchorRowIndex: rowIndex,
                      anchorColumnIndex: index,
                      hasMoved: false,
                    };
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
                    onSelectionInteractionChange?.(true);
                    suppressNextSelectionClickRef.current = true;
                    updateDragSelection(rowIndex);
                  }}
                  onMouseUp={() => {
                    const dragSelection = dragSelectionRef.current;

                    if (!dragSelection) {
                      return;
                    }

                    if (dragSelection.hasMoved) {
                      suppressNextSelectionClickRef.current = true;
                    }
                  }}
                  onClick={(event) => {
                    if (isSelectionDisabled) {
                      event.stopPropagation();
                      return;
                    }

                    if (!isInteractiveColumn) {
                      event.stopPropagation();
                      return;
                    }

                    if (!canCellClick) return;

                    if (suppressNextSelectionClickRef.current) {
                      clearSuppressedSelectionClick();
                      event.preventDefault();
                      event.stopPropagation();
                      return;
                    }

                    event.stopPropagation();
                    onCellClick(date, column.id, {
                      additive: false,
                    });
                  }}
                >
                  {column.id === NIGHT_FREE_COLUMN_ID ? (
                    automaticNightVacationDoctors.length > 0 ? (
                      <span>{automaticNightVacationDoctors.join("/")}</span>
                    ) : (
                      "-"
                    )
                  ) : shift ? (
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
                getContentCellStateClassName({
                  isConflict: hasVacationConflict,
                  isWeekendOrHoliday,
                }),
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
        onClose={() => onQuickAssignClose?.()}
        onHighlightChange={(index) => onQuickAssignHighlightChange?.(index)}
        onShowAvailableOnlyChange={(value) =>
          onQuickAssignShowAvailableOnlyChange?.(value)
        }
      />
    </MonthlyTableBase>
  );
}
