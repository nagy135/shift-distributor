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
import { AUTO_DISTRIBUTE_SHIFT_TYPES, SHIFT_TYPES } from "@/lib/shifts";
import { shiftsApi, unavailableDatesApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-client";

type ShiftAssignment = CalendarShiftTarget & {
  doctorIds: number[];
};

export default function CalendarPage() {
  const { user, accessToken } = useAuth();
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
  } = useCalendarQueries(month, accessToken);

  const clearSelectedTargets = useCallback(() => {
    setSelectedTargets([]);
  }, []);

  const closeQuickAssign = useCallback(() => {
    setIsQuickAssignOpen(false);
    setQuickAssignSearchTerm("");
    setQuickAssignHighlightedIndex(0);
    setQuickAssignDoctorIds([]);
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
    () =>
      doctors
        .filter((doctor) => !doctor.disabled)
        .map((doctor) => ({
          value: doctor.id.toString(),
          label: doctor.name,
          color: doctor.color ?? undefined,
        })),
    [doctors],
  );

  const filteredQuickAssignOptions = useMemo(() => {
    const normalizedTerm = quickAssignSearchTerm.trim().toLowerCase();

    if (!normalizedTerm) {
      return quickAssignOptions;
    }

    return quickAssignOptions.filter((doctor) =>
      doctor.label.toLowerCase().includes(normalizedTerm),
    );
  }, [quickAssignOptions, quickAssignSearchTerm]);

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
    setSelectedDate(undefined);
    setSelectedShiftType(null);
    setSelectedShiftTypes(
      Array.from(new Set(selectedTargets.map((target) => target.shiftType))),
    );
    setIsAssignModalOpen(true);
  }, [isShiftAssigner, selectedTargets]);

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
      setQuickAssignDoctorIds([]);
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

    setQuickAssignDoctorIds(hasSameAssignments ? firstDoctorList : []);
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
          await shiftsApi.assignBatch(payload, accessToken);
          await invalidateShifts();
        }
      } catch (error) {
        console.error("Error assigning shifts:", error);
      }
    },
    [accessToken, assignShiftMutation, invalidateShifts, isShiftAssigner],
  );

  const handleQuickAssignToggle = useCallback((doctorId: string) => {
    setQuickAssignDoctorIds((current) =>
      current.includes(doctorId)
        ? current.filter((entry) => entry !== doctorId)
        : [...current, doctorId],
    );
  }, []);

  const handleQuickAssignOptionClick = useCallback(
    async (doctorId: string, additive: boolean) => {
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
      isShiftAssigner,
      selectedTargets,
    ],
  );

  const handleQuickAssignApply = useCallback(async () => {
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
    isShiftAssigner,
    quickAssignDoctorIds,
    selectedTargets,
  ]);

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
      await shiftsApi.assignBatch(assignments, accessToken);

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
        onSelectionChange={isShiftAssigner ? setSelectedTargets : undefined}
        onSelectionInteractionChange={
          isShiftAssigner ? setIsSelectionInteractionActive : undefined
        }
        quickAssignOpen={assignmentMode === "quick" && isQuickAssignOpen}
        quickAssignFilterText={quickAssignSearchTerm}
        quickAssignHighlightedIndex={quickAssignHighlightedIndex}
        quickAssignOptions={quickAssignOptions}
        quickAssignSelectedValues={quickAssignDoctorIds}
        onQuickAssignOptionClick={(value, additive) => {
          void handleQuickAssignOptionClick(value, additive);
        }}
        onQuickAssignToggle={handleQuickAssignToggle}
        onQuickAssignApply={() => {
          void handleQuickAssignApply();
        }}
        onQuickAssignClose={closeQuickAssign}
        onQuickAssignHighlightChange={setQuickAssignHighlightedIndex}
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
