"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
} from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { MonthSelector } from "@/components/MonthSelector";
import { ShiftAssignmentModal } from "@/components/shifts/ShiftAssignmentModal";
import type { QuickAssignOption } from "@/components/shifts/QuickAssignOverlay";
import { CalendarHeaderActions } from "@/components/calendar/CalendarHeaderActions";
import { CalendarContent } from "@/components/calendar/CalendarContent";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportMonthTable } from "@/components/calendar/export-month-table";
import {
  getShiftForType,
  getShiftTargetKey,
  type CalendarCellClickOptions,
  type CalendarShiftTarget,
} from "@/components/calendar/utils";
import { useCalendarQueries } from "@/components/calendar/useCalendarQueries";
import { useMonthStore } from "@/lib/month-store";
import { useDistributeLockStore } from "@/lib/distribute-lock-store";
import { generateAssignmentsForMonth } from "@/lib/scheduler";
import {
  ALL_CALENDAR_SHIFT_TYPES,
  AUTO_DISTRIBUTE_SHIFT_TYPES,
  SHIFT_TYPES,
  doesCalendarShiftUnavailableDateClash,
  isDayDutyShiftType,
  isShiftType,
} from "@/lib/shifts";
import { useAuth } from "@/lib/auth-client";
import { useApiClient } from "@/lib/use-api-client";

type ShiftAssignment = CalendarShiftTarget & {
  doctorIds: number[];
};

export default function CalendarPage() {
  const { user } = useAuth();
  const { shiftsApi, unavailableDatesApi } = useApiClient();
  const isShiftAssigner = user?.role === "shift_assigner";
  const [assignmentMode, setAssignmentMode] = useState<"quick" | "slow">(
    "slow",
  );
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const { month } = useMonthStore();
  const [isDistributing, setIsDistributing] = useState(false);
  const [isDistributeConfirmOpen, setIsDistributeConfirmOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isQuickAssignOpen, setIsQuickAssignOpen] = useState(false);
  const [isSelectionInteractionActive, setIsSelectionInteractionActive] =
    useState(false);
  const [quickAssignSearchTerm, setQuickAssignSearchTerm] = useState("");
  const [quickAssignHighlightedIndex, setQuickAssignHighlightedIndex] =
    useState(0);
  const [quickAssignDoctorIds, setQuickAssignDoctorIds] = useState<string[]>([]);
  const [quickAssignShowAvailableOnly, setQuickAssignShowAvailableOnly] =
    useState(false);
  const [selectedShiftType, setSelectedShiftType] = useState<string | null>(
    null,
  );
  const [selectedShiftTypes, setSelectedShiftTypes] = useState<string[]>([
    ...SHIFT_TYPES,
  ]);
  const [selectedTargets, setSelectedTargets] = useState<CalendarShiftTarget[]>(
    [],
  );
  const { isLocked, toggleLocked } = useDistributeLockStore();
  const {
    doctors,
    allShifts,
    shiftsLoading,
    unavailableByDoctor,
    approvedVacationsByDate,
    assignShiftMutation,
    invalidateShifts,
  } = useCalendarQueries(month);

  const clearSelectedTargets = useCallback(() => {
    setSelectedTargets([]);
  }, []);

  const notifyLocked = useCallback(() => {
    toast.error("Tabelle ist gesperrt und kann nicht bearbeitet werden.");
  }, []);

  const closeQuickAssign = useCallback(() => {
    setIsQuickAssignOpen(false);
    setQuickAssignSearchTerm("");
    setQuickAssignHighlightedIndex(0);
    setQuickAssignDoctorIds((current) => (current.length === 0 ? current : []));
  }, []);

  const selectedCellKeys = useMemo(
    () => new Set(selectedTargets.map((target) => getShiftTargetKey(target))),
    [selectedTargets],
  );

  const selectedTargetsKey = useMemo(
    () => selectedTargets.map((target) => getShiftTargetKey(target)).join("|"),
    [selectedTargets],
  );

  const quickAssignOptions = useMemo<QuickAssignOption[]>(
    () => {
      const selectedTargetKeys = new Set(
        selectedTargets.map((target) => getShiftTargetKey(target)),
      );

      const isDoctorAllowed = (doctor: (typeof doctors)[number]) =>
        selectedTargets.every((target) =>
          target.shiftType === "oa" ? doctor.oa : !doctor.oa,
        );

      const isDoctorAssignedToTarget = (
        doctorId: number,
        target: CalendarShiftTarget,
      ) => {
        if (selectedTargetKeys.has(getShiftTargetKey(target))) {
          return true;
        }

        const shift = getShiftForType({
          date: target.date,
          shiftType: target.shiftType,
          allShifts,
        });

        return Array.isArray(shift?.doctorIds)
          ? shift.doctorIds.includes(doctorId)
          : false;
      };

      const hasDoctorConflict = (doctorId: number) => {
        const doctor = doctors.find((entry) => entry.id === doctorId);

        if (!doctor) {
          return false;
        }

        return selectedTargets.some((target) => {
          const dateKey = format(target.date, "yyyy-MM-dd");
          const dateConflict = doesCalendarShiftUnavailableDateClash(
            target.shiftType,
          )
            ? (unavailableByDoctor[doctorId]?.has(dateKey) ?? false)
            : false;
          const shiftTypeConflict =
            isShiftType(target.shiftType) &&
            doctor.unavailableShiftTypes &&
            Array.isArray(doctor.unavailableShiftTypes)
              ? doctor.unavailableShiftTypes.includes(target.shiftType)
              : false;
          const vacationConflict = (approvedVacationsByDate[dateKey] ?? []).includes(
            doctor.name,
          );
          const nightOverlapConflict =
            target.shiftType === "night"
              ? ALL_CALENDAR_SHIFT_TYPES.some(
                  (shiftType) =>
                    isDayDutyShiftType(shiftType) &&
                    isDoctorAssignedToTarget(doctorId, {
                      date: target.date,
                      shiftType,
                    }),
                )
              : isDayDutyShiftType(target.shiftType) &&
                isDoctorAssignedToTarget(doctorId, {
                  date: target.date,
                  shiftType: "night",
                });

          return (
            dateConflict ||
            shiftTypeConflict ||
            vacationConflict ||
            nightOverlapConflict
          );
        });
      };

      return doctors
        .filter((doctor) => !doctor.disabled)
        .filter(isDoctorAllowed)
        .map((doctor) => ({
          value: doctor.id.toString(),
          label: doctor.name,
          color: doctor.color ?? undefined,
          hasConflict: hasDoctorConflict(doctor.id),
        }));
    },
    [
      allShifts,
      approvedVacationsByDate,
      doctors,
      selectedTargets,
      unavailableByDoctor,
    ],
  );

  const filteredQuickAssignOptions = useMemo(() => {
    const normalizedTerm = quickAssignSearchTerm.trim().toLowerCase();

    return quickAssignOptions.filter((doctor) => {
      if (quickAssignShowAvailableOnly && doctor.hasConflict) {
        return false;
      }

      return !normalizedTerm
        ? true
        : doctor.label.toLowerCase().includes(normalizedTerm);
    });
  }, [
    quickAssignOptions,
    quickAssignSearchTerm,
    quickAssignShowAvailableOnly,
  ]);

  useEffect(() => {
    const maxHighlightedIndex = Math.max(filteredQuickAssignOptions.length - 1, 0);

    if (quickAssignHighlightedIndex <= maxHighlightedIndex) {
      return;
    }

    setQuickAssignHighlightedIndex(maxHighlightedIndex);
  }, [filteredQuickAssignOptions.length, quickAssignHighlightedIndex]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");

    const updateAssignmentMode = (matches: boolean) => {
      setAssignmentMode(matches ? "quick" : "slow");
    };

    updateAssignmentMode(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      updateAssignmentMode(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  const openAssignModalForSelection = useCallback(() => {
    if (!isShiftAssigner || selectedTargets.length === 0) return;
    if (isLocked) {
      notifyLocked();
      return;
    }
    setSelectedDate(undefined);
    setSelectedShiftType(null);
    setSelectedShiftTypes(
      Array.from(new Set(selectedTargets.map((target) => target.shiftType))),
    );
    setIsAssignModalOpen(true);
  }, [isLocked, isShiftAssigner, notifyLocked, selectedTargets]);

  useEffect(() => {
    if (
      assignmentMode !== "slow" ||
      !isShiftAssigner ||
      selectedTargets.length === 0 ||
      isAssignModalOpen
    ) {
      return;
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== "Control" && event.key !== "Meta") {
        return;
      }
      openAssignModalForSelection();
    };

    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    assignmentMode,
    isAssignModalOpen,
    isShiftAssigner,
    openAssignModalForSelection,
    selectedTargets.length,
  ]);

  useEffect(() => {
    if (
      assignmentMode === "quick" &&
      selectedTargets.length > 0 &&
      !isSelectionInteractionActive
    ) {
      setIsQuickAssignOpen(true);
      return;
    }

    closeQuickAssign();
  }, [
    assignmentMode,
    closeQuickAssign,
    isSelectionInteractionActive,
    selectedTargets.length,
    selectedTargetsKey,
  ]);

  useEffect(() => {
    if (assignmentMode !== "quick" || selectedTargets.length === 0) {
      setQuickAssignDoctorIds((current) => (current.length === 0 ? current : []));
      return;
    }

    const currentDoctorLists = selectedTargets.map((target) => {
      const shift = getShiftForType({
        date: target.date,
        shiftType: target.shiftType,
        allShifts,
      });

      return Array.isArray(shift?.doctorIds)
        ? shift.doctorIds.map((doctorId) => doctorId.toString())
        : [];
    });

    const firstDoctorList = currentDoctorLists[0] ?? [];
    const hasSameAssignments = currentDoctorLists.every(
      (doctorIds) =>
        doctorIds.length === firstDoctorList.length &&
        doctorIds.every((doctorId, index) => doctorId === firstDoctorList[index]),
    );

    const nextDoctorIds = hasSameAssignments ? firstDoctorList : [];

    setQuickAssignDoctorIds((current) => {
      if (
        current.length === nextDoctorIds.length &&
        current.every((doctorId, index) => doctorId === nextDoctorIds[index])
      ) {
        return current;
      }

      return nextDoctorIds;
    });
  }, [allShifts, assignmentMode, selectedTargets]);

  const handleAssignModalOpenChange = useCallback(
    (open: boolean) => {
      setIsAssignModalOpen(open);
      if (!open) {
        clearSelectedTargets();
      }
    },
    [clearSelectedTargets],
  );

  const openAssignModalForDate = (
    date: Date,
    shiftTypes: readonly string[],
  ) => {
    if (!isShiftAssigner) return;
    if (isLocked) {
      notifyLocked();
      return;
    }
    closeQuickAssign();
    clearSelectedTargets();
    setSelectedDate(date);
    setSelectedShiftTypes([...shiftTypes]);
    setSelectedShiftType(null);
    setIsAssignModalOpen(true);
  };

  const openAssignModalForCell = (
    date: Date,
    shiftType: string,
    shiftTypes: readonly string[],
    options: CalendarCellClickOptions,
  ) => {
    if (!isShiftAssigner) return;
    if (isLocked) {
      notifyLocked();
      return;
    }

    if (options.additive) {
      const nextTarget = { date, shiftType };
      const nextKey = getShiftTargetKey(nextTarget);

      setSelectedTargets((previousTargets) => {
        const hasTarget = previousTargets.some(
          (target) => getShiftTargetKey(target) === nextKey,
        );

        if (hasTarget) {
          return previousTargets.filter(
            (target) => getShiftTargetKey(target) !== nextKey,
          );
        }

        return [...previousTargets, nextTarget];
      });
      return;
    }

    if (assignmentMode === "quick") {
      closeQuickAssign();
      setSelectedTargets([{ date, shiftType }]);
      return;
    }

    closeQuickAssign();
    clearSelectedTargets();
    setSelectedDate(date);
    setSelectedShiftTypes([...shiftTypes]);
    setSelectedShiftType(shiftType);
    setIsAssignModalOpen(true);
  };

  const handleShiftAssignments = useCallback(
    async (assignments: ShiftAssignment[]) => {
      if (!isShiftAssigner) return;
      if (isLocked) {
        notifyLocked();
        return;
      }

      if (assignments.length === 0) return;

      const payload = assignments.map((assignment) => ({
        date: format(assignment.date, "yyyy-MM-dd"),
        shiftType: assignment.shiftType,
        doctorIds: assignment.doctorIds,
      }));

      try {
        if (payload.length === 1) {
          await assignShiftMutation.mutateAsync(payload[0]);
        } else {
          await shiftsApi.assignBatch(payload);
          await invalidateShifts();
        }
      } catch (error) {
        console.error("Error assigning shifts:", error);
      }
    },
    [
      assignShiftMutation,
      invalidateShifts,
      isLocked,
      isShiftAssigner,
      notifyLocked,
      shiftsApi,
    ],
  );

  const handleQuickAssignToggle = useCallback((doctorId: string) => {
    if (isLocked) {
      notifyLocked();
      return;
    }

    setQuickAssignDoctorIds((current) =>
      current.includes(doctorId)
        ? current.filter((entry) => entry !== doctorId)
        : [...current, doctorId],
    );
  }, [isLocked, notifyLocked]);

  const handleQuickAssignOptionClick = useCallback(
    async (doctorId: string, additive: boolean) => {
      if (isLocked) {
        notifyLocked();
        return;
      }

      if (additive) {
        setQuickAssignDoctorIds((current) =>
          current.includes(doctorId) ? current : [...current, doctorId],
        );
        return;
      }

      if (!isShiftAssigner || selectedTargets.length === 0) {
        return;
      }

      const parsedDoctorId = Number(doctorId);

      if (!Number.isInteger(parsedDoctorId)) {
        return;
      }

      await handleShiftAssignments(
        selectedTargets.map((target) => ({
          ...target,
          doctorIds: [parsedDoctorId],
        })),
      );
      closeQuickAssign();
      clearSelectedTargets();
    },
    [
      clearSelectedTargets,
      closeQuickAssign,
      handleShiftAssignments,
      isLocked,
      isShiftAssigner,
      notifyLocked,
      selectedTargets,
    ],
  );

  const handleQuickAssignApply = useCallback(async () => {
    if (isLocked) {
      notifyLocked();
      return;
    }

    if (!isShiftAssigner || selectedTargets.length === 0) {
      return;
    }

    const doctorIds = quickAssignDoctorIds
      .map((doctorId) => Number(doctorId))
      .filter((doctorId) => Number.isInteger(doctorId));

    await handleShiftAssignments(
      selectedTargets.map((target) => ({
        ...target,
        doctorIds,
      })),
    );
    closeQuickAssign();
    clearSelectedTargets();
  }, [
    clearSelectedTargets,
    closeQuickAssign,
    handleShiftAssignments,
    isLocked,
    isShiftAssigner,
    notifyLocked,
    quickAssignDoctorIds,
    selectedTargets,
  ]);

  useEffect(() => {
    if (!isLocked) {
      return;
    }

    setIsAssignModalOpen(false);
    setIsQuickAssignOpen(false);
    setIsSelectionInteractionActive(false);
    clearSelectedTargets();
  }, [clearSelectedTargets, isLocked]);

  useEffect(() => {
    if (
      assignmentMode !== "quick" ||
      !isShiftAssigner ||
      selectedTargets.length === 0 ||
      isAssignModalOpen
    ) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      if (
        target?.closest(
          'input, textarea, select, button, [contenteditable="true"]',
        )
      ) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeQuickAssign();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setIsQuickAssignOpen(true);
        setQuickAssignHighlightedIndex((current) =>
          filteredQuickAssignOptions.length === 0
            ? 0
            : Math.min(current + 1, filteredQuickAssignOptions.length - 1),
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setIsQuickAssignOpen(true);
        setQuickAssignHighlightedIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();

        if (event.metaKey || event.ctrlKey) {
          void handleQuickAssignApply();
          return;
        }

        const highlightedOption =
          filteredQuickAssignOptions[quickAssignHighlightedIndex];

        if (highlightedOption) {
          handleQuickAssignToggle(highlightedOption.value);
          return;
        }

        setIsQuickAssignOpen(true);
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        setIsQuickAssignOpen(true);
        setQuickAssignHighlightedIndex(0);
        setQuickAssignSearchTerm((current) => current.slice(0, -1));
        return;
      }

      if (
        event.key.length !== 1 ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();
      setIsQuickAssignOpen(true);
      setQuickAssignHighlightedIndex(0);
      setQuickAssignSearchTerm((current) => current + event.key);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    assignmentMode,
    closeQuickAssign,
    filteredQuickAssignOptions,
    handleQuickAssignApply,
    handleQuickAssignToggle,
    isAssignModalOpen,
    isShiftAssigner,
    quickAssignHighlightedIndex,
    selectedTargets.length,
  ]);

  const handleDistributeMonth = useCallback(() => {
    if (!isShiftAssigner || isDistributing) return;
    setIsDistributeConfirmOpen(true);
  }, [isDistributing, isShiftAssigner]);

  const confirmDistributeMonth = async () => {
    if (!isShiftAssigner) return;

    try {
      setIsDistributeConfirmOpen(false);
      setIsDistributing(true);
      const range = {
        start: startOfMonth(month),
        end: endOfMonth(month),
      };
      const dates = eachDayOfInterval(range);

      // Build unavailable map for all doctors
      const unavailableDatesByDoctorEntries = await Promise.all(
        doctors.map(async (d) => {
          const records = await unavailableDatesApi.getByDoctor(d.id);
          const set = new Set(records.map((r) => r.date));
          return [d.id, set] as const;
        }),
      );
      const unavailableDatesByDoctor = Object.fromEntries(
        unavailableDatesByDoctorEntries,
      );

      for (const shift of allShifts) {
        if (shift.shiftType !== "night") continue;
        if (!Array.isArray(shift.doctorIds) || shift.doctorIds.length === 0) {
          continue;
        }
        if (!isSameMonth(new Date(shift.date), month)) continue;
        for (const doctorId of shift.doctorIds) {
          if (!unavailableDatesByDoctor[doctorId]) {
            unavailableDatesByDoctor[doctorId] = new Set();
          }
          unavailableDatesByDoctor[doctorId].add(shift.date);
        }
      }

      const assignments = generateAssignmentsForMonth({
        dates,
        doctors,
        shiftTypes: AUTO_DISTRIBUTE_SHIFT_TYPES,
        unavailableDatesByDoctor,
      });

      // Use batch endpoint for all assignments in a single request
      await shiftsApi.assignBatch(assignments);

      // Ensure fresh data when done
      await invalidateShifts();
    } catch (err) {
      console.error("Distribution failed", err);
    } finally {
      setIsDistributing(false);
    }
  };

  const handleExportMonthTable = async () => {
    try {
      await exportMonthTable({ month, allShifts });
    } catch (error) {
      console.error("Export failed", error);
    }
  };

  return (
    <div className="space-y-6">
      <MonthSelector
        rightActions={
          <CalendarHeaderActions
            onDistribute={handleDistributeMonth}
            onToggleLocked={toggleLocked}
            onExport={handleExportMonthTable}
            isLocked={isLocked}
            isDistributing={isDistributing}
            shiftsLoading={shiftsLoading}
            doctorsCount={doctors.length}
            showDistribute={isShiftAssigner}
            showLockToggle={isShiftAssigner}
          />
        }
      />

      <CalendarContent
        month={month}
        shiftsLoading={shiftsLoading}
        doctors={doctors}
        allShifts={allShifts}
        unavailableByDoctor={unavailableByDoctor}
        approvedVacationsByDate={approvedVacationsByDate}
        selectedTargets={selectedTargets}
        selectedCellKeys={selectedCellKeys}
        onRowClick={isShiftAssigner ? openAssignModalForDate : undefined}
        onCellClick={isShiftAssigner ? openAssignModalForCell : undefined}
        onSelectionChange={
          isShiftAssigner
            ? (targets) => {
                if (isLocked) {
                  notifyLocked();
                  return;
                }

                setSelectedTargets(targets);
              }
            : undefined
        }
        onSelectionInteractionChange={
          isShiftAssigner ? setIsSelectionInteractionActive : undefined
        }
        quickAssignOpen={assignmentMode === "quick" && isQuickAssignOpen}
        quickAssignFilterText={quickAssignSearchTerm}
        quickAssignHighlightedIndex={quickAssignHighlightedIndex}
        quickAssignOptions={quickAssignOptions}
        quickAssignSelectedValues={quickAssignDoctorIds}
        quickAssignShowAvailableOnly={quickAssignShowAvailableOnly}
        onQuickAssignOptionClick={(value, additive) => {
          void handleQuickAssignOptionClick(value, additive);
        }}
        onQuickAssignToggle={handleQuickAssignToggle}
        onQuickAssignApply={() => {
          void handleQuickAssignApply();
        }}
        onQuickAssignClose={closeQuickAssign}
        onQuickAssignHighlightChange={setQuickAssignHighlightedIndex}
        onQuickAssignShowAvailableOnlyChange={setQuickAssignShowAvailableOnly}
      />

      {/* Reusable shift assignment modal for table rows */}
      <ShiftAssignmentModal
        open={isAssignModalOpen && isShiftAssigner}
        onOpenChange={handleAssignModalOpenChange}
        date={selectedDate}
        targets={selectedTargets}
        doctors={doctors}
        getShift={(date, shiftType) =>
          getShiftForType({ date, shiftType, allShifts })
        }
        shiftTypes={selectedShiftTypes}
        focusShiftType={selectedShiftType}
        onAssign={handleShiftAssignments}
        unavailableByDoctor={unavailableByDoctor}
        approvedVacationsByDate={approvedVacationsByDate}
      />

      <Dialog
        open={isDistributeConfirmOpen && isShiftAssigner}
        onOpenChange={setIsDistributeConfirmOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dienste verteilen?</DialogTitle>
            <DialogDescription>
              {`Die automatische Verteilung wird fuer ${format(month, "MMMM yyyy", { locale: de })} gestartet und kann bestehende Eintraege ueberschreiben.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDistributeConfirmOpen(false)}
              disabled={isDistributing}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={confirmDistributeMonth}
              disabled={isDistributing}
            >
              Verteilung starten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
