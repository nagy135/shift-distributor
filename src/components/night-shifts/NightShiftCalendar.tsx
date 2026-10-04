"use client";

import {
  DoctorPicker,
  type DoctorPickerOption,
} from "@/components/doctor-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { NightShift, ShiftDoctor } from "@/lib/api";
import { useAnchoredOverlay } from "@/lib/use-anchored-overlay";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Loader2, Table2 } from "lucide-react";
import { memo, useRef, type ComponentProps } from "react";
import {
  getDefaultClassNames,
  DayButton as RdpDayButton,
} from "react-day-picker";

export const EMPTY_NIGHT_SHIFTS: NightShift[] = [];
export const DEFAULT_DOCTOR_COLOR = "#64748b";
export const ALL_DOCTORS_VALUE = "all";
export const alphabeticCollator = new Intl.Collator("de", {
  sensitivity: "base",
});
export const NIGHT_SHIFT_TABLE_COLUMN = {
  id: "night",
  label: "Nachtdienst",
} as const;

export const dayToKey = (day: Date) => format(day, "yyyy-MM-dd");

export const sortDoctorsAlphabetically = (doctors: ShiftDoctor[]) => {
  return [...doctors].sort((left, right) =>
    alphabeticCollator.compare(left.name, right.name),
  );
};

export type NightShiftsMonthCalendarProps = {
  month: Date;
  doctorsByDate: Map<string, ShiftDoctor[]>;
  canManage: boolean;
  canOpenMonthTable: boolean;
  isMobile: boolean;
  isUpdating: boolean;
  availableDoctors: DoctorPickerOption[];
  openDate: string | null;
  pickerSearchTerm: string;
  selectedDoctorIdsByDate: Map<string, string[]>;
  onOpenMonthTable: (month: Date) => void;
  onOpenDateChange: (date: string | null) => void;
  onPickerSearchTermChange: (value: string) => void;
  onToggleDoctor: (date: string, doctorId: string) => void;
};

export const NightShiftsMonthCalendar = memo(function NightShiftsMonthCalendar({
  month,
  doctorsByDate,
  canManage,
  canOpenMonthTable,
  isMobile,
  isUpdating,
  availableDoctors,
  openDate,
  pickerSearchTerm,
  selectedDoctorIdsByDate,
  onOpenMonthTable,
  onOpenDateChange,
  onPickerSearchTermChange,
  onToggleDoctor,
}: NightShiftsMonthCalendarProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const pickerPosition = useAnchoredOverlay({
    anchorKey: openDate,
    anchorRefs: cellRefs,
    wrapperRef,
    isEnabled: canManage,
    isMobile,
    alignWithinViewport: true,
    recalculateKey: pickerSearchTerm,
    onRequestClose: () => onOpenDateChange(null),
  });

  return (
    <div ref={wrapperRef} className="relative rounded-md border">
      {canOpenMonthTable ? (
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="absolute right-3 top-3 z-20 size-8"
          aria-label="Monatstabelle öffnen"
          title="Monatstabelle öffnen"
          onClick={(event) => {
            event.stopPropagation();
            onOpenMonthTable(month);
          }}
        >
          <Table2 className="size-4" />
        </Button>
      ) : null}
      <Calendar
        month={month}
        disableNavigation
        showOutsideDays={false}
        onDayClick={(day) => {
          if (!canManage && !isMobile) {
            return;
          }

          onOpenDateChange(dayToKey(day));
        }}
        components={{
          DayButton: (props: ComponentProps<typeof RdpDayButton>) => {
            const { day, className, children, ...rest } = props;
            const dayKey = dayToKey(day.date);
            const doctorsForDay = doctorsByDate.get(dayKey) ?? [];
            const firstDoctorName = doctorsForDay[0]?.name;
            const tooltip = doctorsForDay
              .map((doctor) => doctor.name)
              .join("\n");
            const defaultClassNames = getDefaultClassNames();

            return (
              <Button
                ref={(node) => {
                  if (node) {
                    cellRefs.current.set(dayKey, node);
                  } else {
                    cellRefs.current.delete(dayKey);
                  }
                }}
                variant="ghost"
                size="icon"
                data-day={day.date.toLocaleDateString()}
                data-open={openDate === dayKey}
                title={!isMobile ? tooltip || undefined : undefined}
                className={cn(
                  "relative flex aspect-square size-auto w-full min-w-(--cell-size) items-start justify-start overflow-hidden rounded-md px-1 py-0.5 text-left font-normal hover:bg-transparent",
                  canManage && "cursor-pointer",
                  openDate === dayKey && "ring-2 ring-sky-500 ring-offset-1",
                  defaultClassNames.day,
                  className,
                )}
                {...rest}
              >
                {doctorsForDay.length > 0 && (
                  <span className="absolute inset-0 overflow-hidden rounded-md">
                    {doctorsForDay.map((doctor, index) => {
                      const segmentHeight = 100 / doctorsForDay.length;
                      return (
                        <span
                          key={`${doctor.id}-${index}`}
                          className="absolute inset-x-0 opacity-80"
                          style={{
                            top: `${index * segmentHeight}%`,
                            height: `${segmentHeight}%`,
                            backgroundColor:
                              doctor.color ?? DEFAULT_DOCTOR_COLOR,
                          }}
                        />
                      );
                    })}
                  </span>
                )}
                <span className="relative z-10 text-xs font-medium leading-none">
                  {children}
                </span>
                {firstDoctorName ? (
                  <span className="pointer-events-none absolute inset-x-1 top-4 z-10 overflow-hidden whitespace-nowrap text-ellipsis text-[10px] leading-none lg:text-[8px] md:text-[7px] sm:text-[8px]">
                    {firstDoctorName}
                  </span>
                ) : null}
              </Button>
            );
          },
        }}
        className="w-full"
      />

      {canManage && !isMobile && openDate && pickerPosition ? (
        <div
          className="pointer-events-auto absolute z-30 overflow-hidden rounded-lg border bg-background p-3 shadow-xl"
          style={{
            top: pickerPosition.top,
            left: pickerPosition.left,
            minWidth: pickerPosition.minWidth,
          }}
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          {isUpdating ? (
            <Loader2 className="absolute right-3 top-3 size-4 animate-spin text-muted-foreground" />
          ) : null}
          <div className="mb-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Nachtdienst
            </div>
            <div className="mt-1 text-sm font-medium">
              {format(new Date(`${openDate}T00:00:00`), "dd.MM.yyyy")}
            </div>
          </div>
          <DoctorPicker
            open={openDate != null}
            doctors={availableDoctors}
            searchTerm={pickerSearchTerm}
            selectedDoctorIds={selectedDoctorIdsByDate.get(openDate) ?? []}
            onSearchTermChange={onPickerSearchTermChange}
            onToggleDoctor={(doctorId) => {
              onToggleDoctor(openDate, doctorId);
            }}
            onClose={() => onOpenDateChange(null)}
          />
        </div>
      ) : null}

      {canManage && isMobile ? (
        <Dialog
          open={openDate != null}
          onOpenChange={(open) => !open && onOpenDateChange(null)}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Nachtdienst</DialogTitle>
              <DialogDescription>
                {openDate
                  ? `Aerzte fur ${format(new Date(`${openDate}T00:00:00`), "dd.MM.yyyy")} suchen, auswahlen oder entfernen.`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            {openDate ? (
              <div className="relative">
                {isUpdating ? (
                  <Loader2 className="absolute right-0 top-0 size-4 animate-spin text-muted-foreground" />
                ) : null}
                <DoctorPicker
                  open={openDate != null}
                  doctors={availableDoctors}
                  searchTerm={pickerSearchTerm}
                  selectedDoctorIds={
                    selectedDoctorIdsByDate.get(openDate) ?? []
                  }
                  onSearchTermChange={onPickerSearchTermChange}
                  onToggleDoctor={(doctorId) => {
                    onToggleDoctor(openDate, doctorId);
                  }}
                />
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
});
