"use client";

import { useState } from "react";
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
import { getShiftForType } from "@/components/calendar/utils";
import { useCalendarQueries } from "@/components/calendar/useCalendarQueries";
import { useMonthStore } from "@/lib/month-store";
import { useDistributeLockStore } from "@/lib/distribute-lock-store";
import { generateAssignmentsForMonth } from "@/lib/scheduler";
import { AUTO_DISTRIBUTE_SHIFT_TYPES, type ShiftType } from "@/lib/shifts";
import { shiftsApi, unavailableDatesApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-client";

export default function CalendarPage() {
  const { user, accessToken } = useAuth();
  const isShiftAssigner = user?.role === "shift_assigner";
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const { month } = useMonthStore();
  const [isDistributing, setIsDistributing] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedShiftType, setSelectedShiftType] = useState<ShiftType | null>(
    null,
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

  const openAssignModalForDate = (date: Date) => {
    if (!isShiftAssigner) return;
    setSelectedDate(date);
    setSelectedShiftType(null);
    setIsAssignModalOpen(true);
  };

  const openAssignModalForCell = (date: Date, shiftType: ShiftType) => {
    if (!isShiftAssigner) return;
    setSelectedDate(date);
    setSelectedShiftType(shiftType);
    setIsAssignModalOpen(true);
  };

  const handleShiftAssignment = async (
    shiftType: string,
    doctorIds: number[],
  ) => {
    if (!isShiftAssigner) return;
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
        onRowClick={isShiftAssigner ? openAssignModalForDate : undefined}
        onCellClick={isShiftAssigner ? openAssignModalForCell : undefined}
      />

      {/* Reusable shift assignment modal for table rows */}
      <ShiftAssignmentModal
        open={isAssignModalOpen && isShiftAssigner}
        onOpenChange={setIsAssignModalOpen}
        date={selectedDate}
        doctors={doctors}
        getShiftForType={(type) =>
          getShiftForType({ selectedDate, shiftType: type, allShifts })
        }
        focusShiftType={selectedShiftType}
        onAssign={async (type, ids) => {
          if (!selectedDate) return;
          await handleShiftAssignment(type, ids);
        }}
        unavailableByDoctor={unavailableByDoctor}
        approvedVacationsByDate={approvedVacationsByDate}
      />
    </div>
  );
}
