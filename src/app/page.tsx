"use client";

import { useState, useCallback } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { ClientOnly } from "@/components/client-only";
import { doctorsApi, shiftsApi, unavailableDatesApi, type UnavailableDate } from "@/lib/api";
import { generateAssignmentsForMonth } from "@/lib/scheduler";
import { SHIFT_TYPES, isWeekendOnly } from "@/lib/shifts";
import { MonthlyShiftTable } from "@/components/shifts/MonthlyShiftTable";
import { ShiftAssignmentModal } from "@/components/shifts/ShiftAssignmentModal";

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [isDistributing, setIsDistributing] = useState(false);
  const [useTableView, setUseTableView] = useState(true);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // Queries
  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors'],
    queryFn: doctorsApi.getAll,
  });

  const { data: allShifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ['shifts', doctors?.map(d => `${d.id}:${d.color ?? ''}`).join('|')],
    queryFn: shiftsApi.getAll,
  });

  // Unavailable dates map for all doctors (used for conflict highlighting in table view)
  const { data: unavailableByDoctor = {} } = useQuery({
    queryKey: ['unavailable-by-doctor', doctors?.map(d => `${d.id}:${d.color ?? ''}`).join('|')],
    queryFn: async () => {
      const entries = await Promise.all(
        (doctors ?? []).map(async (d) => {
          const records: UnavailableDate[] = await unavailableDatesApi.getByDoctor(d.id)
          return [d.id, new Set(records.map((r) => r.date))] as const
        })
      )
      return Object.fromEntries(entries) as Record<number, Set<string>>
    },
    enabled: (doctors ?? []).length > 0,
  })

  // Remove the individual date query - we'll filter from allShifts instead

  // Mutations
  const assignShiftMutation = useMutation({
    mutationFn: shiftsApi.assign,
    onSuccess: () => {
      // Only invalidate the main shifts query since we're not using individual date queries anymore
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
  });

  const handleDateSelect = useCallback((date: Date | undefined) => {
    setSelectedDate(date);
    if (date) setIsAssignModalOpen(true);
  }, []);

  const openAssignModalForDate = (date: Date) => {
    setSelectedDate(date);
    setIsAssignModalOpen(true);
  };

  const handleShiftAssignment = async (shiftType: string, doctorId: number | null) => {
    if (!selectedDate) return;

    try {
      await assignShiftMutation.mutateAsync({
        date: format(selectedDate, 'yyyy-MM-dd'),
        shiftType,
        doctorId,
      });
    } catch (error) {
      console.error('Error assigning shift:', error);
    }
  };

  const handleDistributeMonth = async () => {
    try {
      setIsDistributing(true);
      const range = {
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
      };
      const dates = eachDayOfInterval(range);

      // Build unavailable map for all doctors
      const unavailableDatesByDoctorEntries = await Promise.all(
        doctors.map(async (d) => {
          const records = await unavailableDatesApi.getByDoctor(d.id);
          const set = new Set(records.map((r) => r.date));
          return [d.id, set] as const;
        })
      );
      const unavailableDatesByDoctor = Object.fromEntries(unavailableDatesByDoctorEntries);

      const assignments = generateAssignmentsForMonth({
        dates,
        doctors,
        shiftTypes: SHIFT_TYPES,
        unavailableDatesByDoctor,
      });

      for (const a of assignments) {
        // Overwrite existing assignments for that date/shiftType
        // doctorId may be null in rare cases (e.g., no doctors). API supports null.
        await assignShiftMutation.mutateAsync({
          date: a.date,
          shiftType: a.shiftType,
          doctorId: a.doctorId,
        });
      }

      // Ensure fresh data when done
      await queryClient.invalidateQueries({ queryKey: ['shifts'] });
    } catch (err) {
      console.error('Distribution failed', err);
    } finally {
      setIsDistributing(false);
    }
  };

  const getShiftForType = (shiftType: string) => {
    if (!selectedDate) return undefined;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return allShifts.find(shift => shift.date === dateStr && shift.shiftType === shiftType);
  };

  // Remove unused memoized calculation

  const isUnassignedDay = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayShifts = allShifts.filter(shift => shift.date === dateStr);
    const isWeekend = [0, 6].includes(getDay(date));

    // Required shift types for this day (exclude weekend-only if weekday)
    const requiredTypes = SHIFT_TYPES.filter(t => isWeekend || !isWeekendOnly(t));

    // For each required type, we must have one shift with a doctor assigned
    for (const type of requiredTypes) {
      const shift = dayShifts.find(s => s.shiftType === type);
      if (!shift || !shift.doctorId) return true; // unassigned
    }

    return false;
  }, [allShifts]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant={useTableView ? 'secondary' : 'outline'} onClick={() => setUseTableView((v) => !v)}>
            {useTableView ? 'Calendar View' : 'Table View'}
          </Button>
          <Button onClick={handleDistributeMonth} disabled={isDistributing || shiftsLoading || doctors.length === 0}>
            {isDistributing ? 'Distributing…' : 'Distribute'}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Calendar - Full Width */}
        <ClientOnly
          fallback={
            <div className="rounded-md border mx-auto max-w-md p-4 text-center text-muted-foreground">
              Loading calendar...
            </div>
          }
        >
          {shiftsLoading ? (
            <div className="rounded-md border mx-auto max-w-md p-4 text-center text-muted-foreground">
              Loading shifts...
            </div>
          ) : useTableView ? (
            <MonthlyShiftTable
              month={currentMonth}
              shifts={allShifts}
              unavailableByDoctor={unavailableByDoctor}
              onRowClick={openAssignModalForDate}
            />
          ) : (
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              className="rounded-md border mx-auto max-w-md"
              showOutsideDays={false}
              modifiers={{
                unassigned: (date) => isUnassignedDay(date),
              }}
              modifiersClassNames={{
                unassigned: "bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/20 dark:text-orange-400",
              }}
              locale={enUS}
              formatters={{
                formatDay: (date) => format(date, 'd'),
              }}
            />
          )}
        </ClientOnly>

        {/* No inline always-open modal in calendar view */}
      </div>

      {/* Reusable shift assignment modal for table rows */}
      <ShiftAssignmentModal
        open={isAssignModalOpen}
        onOpenChange={setIsAssignModalOpen}
        date={selectedDate}
        doctors={doctors}
        getShiftForType={getShiftForType}
        onAssign={async (type, id) => {
          if (!selectedDate) return
          await handleShiftAssignment(type, id)
        }}
        unavailableByDoctor={unavailableByDoctor}
      />
    </div>
  );
}
