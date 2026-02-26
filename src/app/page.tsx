"use client";

import { useState, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
} from "date-fns";
import { Loader2 as LoaderIcon, Trash as TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonthSelector } from "@/components/MonthSelector";
import { ShiftAssignmentModal } from "@/components/shifts/ShiftAssignmentModal";
import { CalendarHeaderActions } from "@/components/calendar/CalendarHeaderActions";
import { CalendarContent } from "@/components/calendar/CalendarContent";
import { ConfirmClearDialog } from "@/components/calendar/ConfirmClearDialog";
import { exportMonthTable } from "@/components/calendar/export-month-table";
import { getShiftForType, isDayUnassigned } from "@/components/calendar/utils";
import { useCalendarQueries } from "@/components/calendar/useCalendarQueries";
import { useMonthStore } from "@/lib/month-store";
import { useDistributeLockStore } from "@/lib/distribute-lock-store";
import { generateAssignmentsForMonth } from "@/lib/scheduler";
import { SHIFT_TYPES } from "@/lib/shifts";
import { shiftsApi, unavailableDatesApi } from "@/lib/api";

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const { month, setMonth } = useMonthStore();
  const [isDistributing, setIsDistributing] = useState(false);
  const [useTableView, setUseTableView] = useState(true);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const { isLocked, toggleLocked } = useDistributeLockStore();
  const {
    doctors,
    allShifts,
    shiftsLoading,
    unavailableByDoctor,
    assignShiftMutation,
    invalidateShifts,
  } = useCalendarQueries();

  const handleDateSelect = useCallback((date: Date | undefined) => {
    setSelectedDate(date);
    if (date) setIsAssignModalOpen(true);
  }, []);

  const openAssignModalForDate = (date: Date) => {
    setSelectedDate(date);
    setIsAssignModalOpen(true);
  };

  const handleShiftAssignment = async (
    shiftType: string,
    doctorIds: number[],
  ) => {
    if (!selectedDate) return;

    try {
      await assignShiftMutation.mutateAsync({
        date: format(selectedDate, "yyyy-MM-dd"),
        shiftType,
        doctorIds,
      });
    } catch (error) {
      console.error("Error assigning shift:", error);
    }
  };

  const handleDistributeMonth = async () => {
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

      const assignments = generateAssignmentsForMonth({
        dates,
        doctors,
        shiftTypes: SHIFT_TYPES,
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

  const handleClearMonthAssignments = async () => {
    try {
      if (isLocked) return;
      setIsClearing(true);

      const targets = allShifts.filter(
        (s) =>
          isSameMonth(new Date(s.date), month) &&
          Array.isArray(s.doctorIds) &&
          s.doctorIds.length > 0,
      );

      // Clear all assigned shifts for the selected month using batch endpoint
      const clearAssignments = targets.map((s) => ({
        date: s.date,
        shiftType: s.shiftType,
        doctorIds: [] as number[],
      }));

      if (clearAssignments.length > 0) {
        await shiftsApi.assignBatch(clearAssignments);
      }

      await invalidateShifts();
    } catch (error) {
      console.error("Failed to clear assignments", error);
    } finally {
      setIsClearing(false);
      setIsConfirmClearOpen(false);
    }
  };

  const isUnassignedDay = useCallback(
    (date: Date) => {
      return isDayUnassigned({ date, allShifts });
    },
    [allShifts],
  );

  return (
    <div className="space-y-6">
      <MonthSelector
        rightActions={
          <CalendarHeaderActions
            useTableView={useTableView}
            onToggleView={() => setUseTableView((v) => !v)}
            onDistribute={handleDistributeMonth}
            onToggleLocked={toggleLocked}
            onExport={handleExportMonthTable}
            isLocked={isLocked}
            isDistributing={isDistributing}
            shiftsLoading={shiftsLoading}
            doctorsCount={doctors.length}
          />
        }
      />

      <CalendarContent
        month={month}
        setMonth={setMonth}
        selectedDate={selectedDate}
        onSelectDate={handleDateSelect}
        useTableView={useTableView}
        shiftsLoading={shiftsLoading}
        doctors={doctors}
        allShifts={allShifts}
        unavailableByDoctor={unavailableByDoctor}
        onRowClick={openAssignModalForDate}
        isUnassignedDay={isUnassignedDay}
      />

      {useTableView && (
        <div className="max-w-2xl mx-auto flex justify-center mt-2">
          <Button
            variant="destructive"
            size="icon"
            onClick={() => setIsConfirmClearOpen(true)}
            disabled={
              isLocked ||
              isDistributing ||
              isClearing ||
              shiftsLoading ||
              !allShifts.some(
                (s) =>
                  isSameMonth(new Date(s.date), month) &&
                  Array.isArray(s.doctorIds) &&
                  s.doctorIds.length > 0,
              )
            }
            title={
              isLocked
                ? "Unlock to enable clearing"
                : "Clear all assignments in this month"
            }
            aria-busy={isClearing}
            aria-label="Clear all assignments in this month"
          >
            {isClearing ? (
              <LoaderIcon className="size-4 animate-spin" />
            ) : (
              <TrashIcon className="size-4" />
            )}
          </Button>
        </div>
      )}

      {/* Confirm Clear Modal */}
      <ConfirmClearDialog
        open={isConfirmClearOpen}
        onOpenChange={setIsConfirmClearOpen}
        onConfirm={handleClearMonthAssignments}
        onCancel={() => setIsConfirmClearOpen(false)}
        isLocked={isLocked}
        isClearing={isClearing}
      />

      {/* Reusable shift assignment modal for table rows */}
      <ShiftAssignmentModal
        open={isAssignModalOpen}
        onOpenChange={setIsAssignModalOpen}
        date={selectedDate}
        doctors={doctors}
        getShiftForType={(type) =>
          getShiftForType({ selectedDate, shiftType: type, allShifts })
        }
        onAssign={async (type, ids) => {
          if (!selectedDate) return;
          await handleShiftAssignment(type, ids);
        }}
        unavailableByDoctor={unavailableByDoctor}
      />
    </div>
  );
}
