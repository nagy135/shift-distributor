"use client";

import { useState, useCallback } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth } from "date-fns";
import { enUS, de } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Table as TableIcon, Download as DownloadIcon, Lock as LockIcon, Unlock as UnlockIcon, Loader2 as LoaderIcon, Trash as TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Pill } from "@/components/ui/pill";
import { ClientOnly } from "@/components/client-only";
import { doctorsApi, shiftsApi, unavailableDatesApi, type UnavailableDate, type Shift, type Doctor } from "@/lib/api";
import { generateAssignmentsForMonth } from "@/lib/scheduler";
import { SHIFT_TYPES, isWeekendOnly, type ShiftType } from "@/lib/shifts";
import { MonthlyShiftTable } from "@/components/shifts/MonthlyShiftTable";
import { ShiftAssignmentModal } from "@/components/shifts/ShiftAssignmentModal";
import { useMonthStore } from "@/lib/month-store";
import { MonthSelector } from "@/components/MonthSelector";
import { useDistributeLockStore } from "@/lib/distribute-lock-store";

function DoctorShiftCounts({ doctors, shifts, month }: { doctors: Doctor[], shifts: Shift[], month: Date }) {
  const shiftCounts = doctors.map(doctor => {
    const doctorShifts = shifts.filter(shift => 
      shift.doctorId === doctor.id && 
      isSameMonth(new Date(shift.date), month)
    );
    return {
      doctor,
      count: doctorShifts.length
    };
  });

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {shiftCounts.map(({ doctor, count }) => (
        <Pill
          key={doctor.id}
          color={doctor.color || undefined}
          className="font-medium"
        >
          {doctor.name}: {count}
        </Pill>
      ))}
    </div>
  );
}

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const { month, setMonth } = useMonthStore();
  const [isDistributing, setIsDistributing] = useState(false);
  const [useTableView, setUseTableView] = useState(true);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const queryClient = useQueryClient();
  const { isLocked, toggleLocked } = useDistributeLockStore();

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
        })
      );
      const unavailableDatesByDoctor = Object.fromEntries(unavailableDatesByDoctorEntries);

      const assignments = generateAssignmentsForMonth({
        dates,
        doctors,
        shiftTypes: SHIFT_TYPES,
        unavailableDatesByDoctor,
      });

      await Promise.all(
        assignments.map((a) =>
          assignShiftMutation.mutateAsync({
            date: a.date,
            shiftType: a.shiftType,
            doctorId: a.doctorId,
          })
        )
      );

      // Ensure fresh data when done
      await queryClient.invalidateQueries({ queryKey: ['shifts'] });
    } catch (err) {
      console.error('Distribution failed', err);
    } finally {
      setIsDistributing(false);
    }
  };

  const handleExportMonthTable = async () => {
    try {
      // Build rows mirroring the table view for the selected month
      const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });

      // Index shifts for the month by date and type
      const shiftIndex = new Map<string, Partial<Record<ShiftType, Shift>>>();
      for (const s of allShifts) {
        const dateObj = new Date(s.date);
        if (!isSameMonth(dateObj, month)) continue;
        const existing = shiftIndex.get(s.date);
        const byType: Partial<Record<ShiftType, Shift>> = existing ?? {};
        byType[s.shiftType as ShiftType] = s;
        shiftIndex.set(s.date, byType);
      }

      // Build a structure like the provided example:
      // [ TagNum | TagKurz | Nachtdienst | 20:00 Dienst | 15:00/17:00 Uhr Dienst | Hintergrund ]
      // Note: We only fill our known shift columns; others remain blank for structure.
      const header = [
        '',
        '',
        'Nachtdienst',
        '20:00 Dienst',
        '15:00/17:00 Uhr Dienst',
        'Hintergrund'
      ];

      const rowsAoa = days.map((d) => {
        const key = format(d, 'yyyy-MM-dd');
        const byType: Partial<Record<ShiftType, Shift>> =
          shiftIndex.get(key) ?? ({} as Partial<Record<ShiftType, Shift>>);
        const isWeekend = [0, 6].includes(d.getDay());

        // Example cell like "1 Di" in German
        const dayNumber = format(d, 'd', { locale: de });
        const dayNameShort = format(d, 'EEE', { locale: de }).replace('.', '');

        // Prepare row with fixed number of columns (6)
        const row: string[] = [dayNumber, dayNameShort, '', '', '', ''];

        // Map our known shifts to the desired columns
        // 20shift -> column index 4, 17shift -> column index 5
        SHIFT_TYPES.forEach((t) => {
          const showDash = isWeekendOnly(t) && !isWeekend;
          const shift = byType[t];
          const value = showDash ? '—' : (shift?.doctorName ?? 'Unassigned');

          if (t === '20shift') row[3] = value;
          if (t === '17shift') row[4] = value;
        });

        return row;
      });

      // Use exceljs for styling (borders, column widths, fills)
      type BorderStyle = { style: 'thin'; color: { argb: string } };
      type ExcelCell = {
        border?: { top: BorderStyle; left: BorderStyle; bottom: BorderStyle; right: BorderStyle };
        alignment?: { vertical?: string; horizontal?: string };
        font?: { bold?: boolean };
        fill?: { type: 'pattern'; pattern: 'solid'; fgColor: { argb: string } };
      };
      type ExcelRow = {
        height?: number;
        eachCell: (callback: (cell: ExcelCell, colNumber: number) => void) => void;
      };
      type ExcelWorksheet = {
        columns: { width: number }[];
        addRow: (values: Array<string | number | null | undefined>) => ExcelRow;
        getCell: (row: number, col: number) => ExcelCell;
        lastRow?: { number: number };
      };
      type ExcelWorkbook = {
        addWorksheet: (
          name: string,
          opts?: { properties?: { defaultRowHeight?: number }; views?: Array<{ state?: string; ySplit?: number }> }
        ) => ExcelWorksheet;
        xlsx: { writeBuffer: () => Promise<ArrayBuffer> };
      };
      type ExcelJSPackage = { Workbook: new () => ExcelWorkbook };

      const ExcelJS = (await import('exceljs')) as unknown as ExcelJSPackage;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Month', {
        properties: { defaultRowHeight: 18 },
        views: [{ state: 'frozen', ySplit: 1 }],
      });

      // Column widths: first two small
      worksheet.columns = [
        { width: 4 },   // day number
        { width: 6 },   // day short name
        { width: 16 },  // Nachtdienst
        { width: 16 },  // 20:00 Dienst
        { width: 22 },  // 15:00/17:00 Uhr Dienst
        { width: 16 },  // Hintergrund
      ];

      // Helper to apply thin border to all sides
      const applyBorder = (cell: ExcelCell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
          left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
          bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
          right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        };
      };

      // Header row
      const headerRow = worksheet.addRow(header);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        applyBorder(cell);
      });

      // Data rows with weekend highlighting
      rowsAoa.forEach((rowVals, idx) => {
        const d = days[idx];
        const isWeekend = [0, 6].includes(d.getDay());
        const row = worksheet.addRow(rowVals);
        row.height = 18;
        row.eachCell((cell, colNumber: number) => {
          // Center small columns
          if (colNumber === 1 || colNumber === 2) {
            cell.alignment = { horizontal: 'center' };
          }
          applyBorder(cell);
          if (isWeekend) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFEDEDED' },
            };
          }
        });
      });

      // Ensure outer border lines by applying borders to entire used range
      const lastRow = worksheet.lastRow?.number ?? 1;
      for (let r = 1; r <= lastRow; r++) {
        for (let c = 1; c <= header.length; c++) {
          const cell = worksheet.getCell(r, c);
          applyBorder(cell);
        }
      }

      const fileName = `Shifts-${format(month, 'yyyy-MM')}.xlsx`;
      const buffer: ArrayBuffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed', error);
    }
  };

  const handleClearMonthAssignments = async () => {
    try {
      if (isLocked) return;
      setIsClearing(true);

      const targets = allShifts.filter(
        (s) => isSameMonth(new Date(s.date), month) && s.doctorId != null
      );

      // Clear all assigned shifts for the selected month
      await Promise.all(
        targets.map((s) =>
          assignShiftMutation.mutateAsync({
            date: s.date,
            shiftType: s.shiftType,
            doctorId: null,
          })
        )
      );

      await queryClient.invalidateQueries({ queryKey: ['shifts'] });
    } catch (error) {
      console.error('Failed to clear assignments', error);
    } finally {
      setIsClearing(false);
      setIsConfirmClearOpen(false);
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
      <MonthSelector
        rightActions={
          <>
            {/* Small screens: icon-only toggle */}
            <Button
              variant="default"
              size="icon"
              onClick={() => setUseTableView((v) => !v)}
              className="lg:hidden"
              aria-label={useTableView ? 'Switch to Calendar View' : 'Switch to Table View'}
            >
              {useTableView ? (
                <CalendarIcon className="size-4" />
              ) : (
                <TableIcon className="size-4" />
              )}
            </Button>

            {/* Large screens: icon + text */}
            <Button
              variant="default"
              onClick={() => setUseTableView((v) => !v)}
              className="hidden lg:inline-flex"
            >
              {useTableView ? (
                <CalendarIcon className="size-4" />
              ) : (
                <TableIcon className="size-4" />
              )}
              <span className="ml-2">{useTableView ? 'Calendar View' : 'Table View'}</span>
            </Button>

            <Button
              variant="outline"
              onClick={handleDistributeMonth}
              disabled={isLocked || isDistributing || shiftsLoading || doctors.length === 0}
              title={isLocked ? 'Unlock to enable distribution' : undefined}
              className="relative"
              aria-busy={isDistributing}
            >
              <span className={isDistributing ? 'opacity-0' : 'opacity-100'}>Distribute</span>
              {isDistributing && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <LoaderIcon className="size-4 animate-spin" />
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleLocked}
              aria-pressed={!isLocked}
              aria-label={isLocked ? 'Locked. Click to unlock' : 'Unlocked. Click to lock'}
              title={isLocked ? 'Locked' : 'Unlocked'}
            >
              {isLocked ? <LockIcon className="size-4" /> : <UnlockIcon className="size-4" />}
            </Button>

            <Button
              variant="default"
              onClick={handleExportMonthTable}
              disabled={shiftsLoading}
            >
              <DownloadIcon className="size-4" />
              <span className="ml-1">Export</span>
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        {/* Doctor Shift Counts */}
        <ClientOnly
          fallback={
            <div className="rounded-md border mx-auto max-w-md p-4 text-center text-muted-foreground">
              Loading shift counts...
            </div>
          }
        >
          {shiftsLoading ? (
            <div className="rounded-md border mx-auto max-w-md p-4 text-center text-muted-foreground">
              Loading shifts...
            </div>
          ) : (
            <DoctorShiftCounts 
              doctors={doctors} 
              shifts={allShifts} 
              month={month} 
            />
          )}
        </ClientOnly>

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
              month={month}
              shifts={allShifts}
              unavailableByDoctor={unavailableByDoctor}
              onRowClick={openAssignModalForDate}
            />
          ) : (
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              month={month}
              onMonthChange={setMonth}
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

      {useTableView && (
        <div className="max-w-2xl mx-auto flex justify-center mt-2">
          <Button
            variant="destructive"
            size="icon"
            onClick={() => setIsConfirmClearOpen(true)}
            disabled={
              isLocked || isDistributing || isClearing || shiftsLoading ||
              !allShifts.some((s) => isSameMonth(new Date(s.date), month) && s.doctorId != null)
            }
            title={isLocked ? 'Unlock to enable clearing' : 'Clear all assignments in this month'}
            aria-busy={isClearing}
            aria-label="Clear all assignments in this month"
          >
            {isClearing ? <LoaderIcon className="size-4 animate-spin" /> : <TrashIcon className="size-4" />}
          </Button>
        </div>
      )}

      {/* Confirm Clear Modal */}
      <Dialog open={isConfirmClearOpen} onOpenChange={setIsConfirmClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{"Reset this month's assignments"}</DialogTitle>
            <DialogDescription>
              This will set all shifts in the selected month to Unassigned. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <div className="flex flex-col items-center items-stretch gap-2">
              <Button
                variant="destructive"
                onClick={handleClearMonthAssignments}
                disabled={isLocked || isClearing}
                aria-busy={isClearing}
              >
                {isClearing ? <LoaderIcon className="size-4 animate-spin" /> : 'Reset'}
              </Button>
              <Button variant="outline" onClick={() => setIsConfirmClearOpen(false)}>
                Cancel
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
