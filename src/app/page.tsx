"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ClientOnly } from "@/components/client-only";
import { Check } from "lucide-react";
import { doctorsApi, shiftsApi } from "@/lib/api";

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const queryClient = useQueryClient();

  // Queries
  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors'],
    queryFn: doctorsApi.getAll,
  });

  const { data: allShifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ['shifts'],
    queryFn: shiftsApi.getAll,
  });

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
  }, []);

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

  const getShiftForType = (shiftType: string) => {
    if (!selectedDate) return undefined;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return allShifts.find(shift => shift.date === dateStr && shift.shiftType === shiftType);
  };

  // Remove this function as it's no longer needed

  // Remove unused memoized calculation

  const isUnassignedDay = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dateShifts = allShifts.filter(shift => shift.date === dateStr);
    return dateShifts.length < 2 || dateShifts.some(shift => !shift.doctorId);
  }, [allShifts]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Calendar</h1>
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
          ) : (
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
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

        {/* Shift Details - Below Calendar */}
        {selectedDate && (
          <div className="max-w-md mx-auto">
            <h2 className="text-xl font-semibold mb-4 text-center">
              Shifts for {format(selectedDate, 'MMMM d, yyyy')}
            </h2>
            
            <div className="space-y-3">
              {/* 17 Shift */}
              <div className="p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-sm">17 Shift</h3>
                    <span className="text-sm text-muted-foreground">
                      {getShiftForType('17shift')?.doctorName || 'No doctor assigned'}
                    </span>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="flex items-center gap-2">
                        {getShiftForType('17shift')?.doctorName ? (
                          <>
                            <Check className="h-4 w-4 text-green-600" />
                            Change
                          </>
                        ) : (
                          'Assign'
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Assign 17 Shift</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Select onValueChange={(value) => handleShiftAssignment('17shift', value === 'none' ? null : parseInt(value))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a doctor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No doctor</SelectItem>
                            {doctors.map((doctor) => (
                              <SelectItem key={doctor.id} value={doctor.id.toString()}>
                                {doctor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* 20 Shift */}
              <div className="p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-sm">20 Shift</h3>
                    <span className="text-sm text-muted-foreground">
                      {getShiftForType('20shift')?.doctorName || 'No doctor assigned'}
                    </span>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="flex items-center gap-2">
                        {getShiftForType('20shift')?.doctorName ? (
                          <>
                            <Check className="h-4 w-4 text-green-600" />
                            Change
                          </>
                        ) : (
                          'Assign'
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Assign 20 Shift</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Select onValueChange={(value) => handleShiftAssignment('20shift', value === 'none' ? null : parseInt(value))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a doctor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No doctor</SelectItem>
                            {doctors.map((doctor) => (
                              <SelectItem key={doctor.id} value={doctor.id.toString()}>
                                {doctor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
