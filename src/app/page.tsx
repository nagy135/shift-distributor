"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
} from "date-fns";
import { MonthSelector } from "@/components/MonthSelector";
import { ShiftAssignmentModal } from "@/components/shifts/ShiftAssignmentModal";
import { CalendarHeaderActions } from "@/components/calendar/CalendarHeaderActions";
import { CalendarContent } from "@/components/calendar/CalendarContent";
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
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const { month } = useMonthStore();
  const [isDistributing, setIsDistributing] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedShiftType, setSelectedShiftType] = useState<string | null>(null);
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

  const selectedCellKeys = useMemo(
    () => new Set(selectedTargets.map((target) => getShiftTargetKey(target))),
    [selectedTargets],
  );

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
    if (!isShiftAssigner || selectedTargets.length === 0 || isAssignModalOpen) {
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
    isAssignModalOpen,
    isShiftAssigner,
    openAssignModalForSelection,
    selectedTargets.length,
  ]);

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

    clearSelectedTargets();
    setSelectedDate(date);
    setSelectedShiftTypes([...shiftTypes]);
    setSelectedShiftType(shiftType);
    setIsAssignModalOpen(true);
  };

  const handleShiftAssignments = async (assignments: ShiftAssignment[]) => {
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
  };

  const handleDistributeMonth = async () => {
    if (!isShiftAssigner) return;
    try {
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
        selectedCellKeys={selectedCellKeys}
        onRowClick={isShiftAssigner ? openAssignModalForDate : undefined}
        onCellClick={isShiftAssigner ? openAssignModalForCell : undefined}
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
    </div>
  );
}
