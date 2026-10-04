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
import { RealPill } from "@/components/ui/real-pill";
import { type VacationDay } from "@/lib/api";
import { type VacationDisplayDay } from "@/lib/night-shift-vacations";
import { useAnchoredOverlay } from "@/lib/use-anchored-overlay";
import { cn } from "@/lib/utils";
import {
  DISPLAY_VACATION_COLORS,
  VACATION_COLOR_STYLES,
  VACATION_COLORS,
  VACATION_DAYS_PER_YEAR,
  type DisplayVacationColor,
  type VacationColor,
} from "@/lib/vacations";
import { format } from "date-fns";
import { CircleHelp, Loader2, Table2 } from "lucide-react";
import { memo, useRef } from "react";
import {
  getDefaultClassNames,
  DayButton as RdpDayButton,
} from "react-day-picker";

export const EMPTY_VACATION_DAYS: VacationDay[] = [];
export const ALL_DOCTORS_VALUE = "all";
export const DEFAULT_DOCTOR_COLOR = "#64748b";
export const alphabeticCollator = new Intl.Collator("de", {
  sensitivity: "base",
});
export const VACATION_TABLE_COLUMN = {
  id: "vacation",
  label: "Urlaub",
} as const;

export const createColorCountMap = (): Record<VacationColor, number> =>
  VACATION_COLORS.reduce(
    (acc, color) => {
      acc[color] = 0;
      return acc;
    },
    {} as Record<VacationColor, number>,
  );

export const createDisplayColorCountMap = (): Record<
  DisplayVacationColor,
  number
> =>
  DISPLAY_VACATION_COLORS.reduce(
    (acc, color) => {
      acc[color] = 0;
      return acc;
    },
    {} as Record<DisplayVacationColor, number>,
  );

export const countColors = (input: Record<string, VacationColor>) => {
  return Object.values(input).reduce((acc, color) => {
    acc[color] += 1;
    return acc;
  }, createColorCountMap());
};

export const dayToKey = (day: Date) => format(day, "yyyy-MM-dd");

export const getVacationDoctorName = (entry: VacationDisplayDay) =>
  entry.doctorName?.trim() || `Arzt #${entry.doctorId ?? "?"}`;

export const compareVacationColors = (
  left: DisplayVacationColor,
  right: DisplayVacationColor,
) =>
  alphabeticCollator.compare(
    VACATION_COLOR_STYLES[left].label,
    VACATION_COLOR_STYLES[right].label,
  );

export const sortVacationEntries = (entries: VacationDisplayDay[]) => {
  return [...entries].sort((left, right) => {
    const doctorComparison = alphabeticCollator.compare(
      getVacationDoctorName(left),
      getVacationDoctorName(right),
    );

    if (doctorComparison !== 0) {
      return doctorComparison;
    }

    const colorComparison = compareVacationColors(left.color, right.color);

    if (colorComparison !== 0) {
      return colorComparison;
    }

    return (left.doctorId ?? 0) - (right.doctorId ?? 0);
  });
};

export const getSortedUniqueNames = (
  names: Array<string | null | undefined>,
) => {
  return Array.from(
    new Set(
      names
        .map((name) => name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ).sort((left, right) => alphabeticCollator.compare(left, right));
};

export const getDayColors = (entries: VacationDisplayDay[]) => {
  const map = new Map<string, VacationDisplayDay[]>();
  entries.forEach((entry) => {
    const list = map.get(entry.date) ?? [];
    list.push(entry);
    map.set(entry.date, sortVacationEntries(list));
  });
  return map;
};

export type VacationMonthCalendarProps = {
  month: Date;
  showVacationOverview: boolean;
  canManageWithPicker: boolean;
  canOpenMonthTable: boolean;
  isMobile: boolean;
  isUpdating: boolean;
  availableDoctors: DoctorPickerOption[];
  openDate: string | null;
  pickerSearchTerm: string;
  selectedDoctorIdsByDate: Map<string, string[]>;
  pickerMarkerClassName?: string;
  modifiers?: Record<DisplayVacationColor, Date[]>;
  modifierClasses?: Record<DisplayVacationColor, string>;
  vacationsByDate: Map<string, VacationDisplayDay[]>;
  hasPendingByDate: Map<string, boolean>;
  onOpenMonthTable: (month: Date) => void;
  onOpenDateChange: (date: string | null) => void;
  onPickerSearchTermChange: (value: string) => void;
  onToggleDoctor: (date: string, doctorId: string) => void;
  onDayClick: (day: Date) => void;
  pickerEnabled: boolean;
};

export type VacationColorControlsProps = {
  canEditAllVacations: boolean;
  canUseVacationEditor: boolean;
  activeColor: VacationColor | null;
  colorCounts: Record<VacationColor, number>;
  onColorSelect: (color: VacationColor) => void;
};

export type VacationEntryPillsProps = {
  entries: VacationDisplayDay[];
  emptyText?: string;
};

export function VacationEntryPills({
  entries,
  emptyText = "Kein Urlaub für diesen Tag.",
}: VacationEntryPillsProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  const sortedEntries = sortVacationEntries(entries);

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">Urlaube an diesem Tag</div>
      <div className="flex flex-wrap gap-1.5">
        {sortedEntries.map((entry) => {
          const doctorKey = String(
            entry.doctorId ?? entry.doctorName ?? entry.date,
          );
          const doctorName = getVacationDoctorName(entry);

          return (
            <RealPill
              key={`${entry.date}-${doctorKey}-${entry.color}`}
              className="max-w-full border border-border/70 bg-muted/40 text-foreground"
              title={`${doctorName} - ${VACATION_COLOR_STYLES[entry.color].label}`}
            >
              <span
                className={cn(
                  "mr-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full",
                  VACATION_COLOR_STYLES[entry.color].classes,
                )}
              />
              <span className="truncate">{doctorName}</span>
            </RealPill>
          );
        })}
      </div>
    </div>
  );
}

export function VacationColorControls({
  canEditAllVacations,
  canUseVacationEditor,
  activeColor,
  colorCounts,
  onColorSelect,
}: VacationColorControlsProps) {
  if (!canUseVacationEditor) {
    return (
      <p className="text-xs text-muted-foreground">
        Wählen Sie sich selbst aus, um Urlaubstage zu bearbeiten.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {VACATION_COLORS.map((color) => {
          const style = VACATION_COLOR_STYLES[color];
          const used = colorCounts[color];
          const yearlyLimit = VACATION_DAYS_PER_YEAR[color];
          const isUnlimited = !Number.isFinite(yearlyLimit);
          const remaining = isUnlimited
            ? Number.POSITIVE_INFINITY
            : Math.max(0, yearlyLimit - used);
          const isActive = activeColor === color;
          const showCounts = !canEditAllVacations;

          return (
            <Button
              key={color}
              type="button"
              title={style.label}
              aria-label={style.label}
              className={cn(
                style.classes,
                "size-9 rounded-full px-0 sm:h-9 sm:w-auto sm:min-w-[88px] sm:rounded-md sm:px-3",
                showCounts
                  ? "justify-center sm:justify-between"
                  : "justify-center sm:min-w-[88px]",
                isActive ? `ring-2 ring-offset-2 ${style.ring}` : "",
              )}
              disabled={
                showCounts && !isUnlimited && remaining === 0 && !isActive
              }
              onClick={() => onColorSelect(color)}
            >
              <span className="sr-only sm:not-sr-only">{style.label}</span>
              {showCounts ? (
                <span className="text-xs opacity-90">
                  <span className="hidden sm:inline">
                    {isUnlimited ? "∞" : `${remaining}/${yearlyLimit}`}
                  </span>
                </span>
              ) : null}
            </Button>
          );
        })}
      </div>
      {!activeColor ? (
        <p className="text-xs text-muted-foreground">
          {canEditAllVacations
            ? "Wählen Sie eine Farbe und klicken Sie dann auf einen Tag."
            : "Wählen Sie eine Farbe, um Tage zu markieren."}
        </p>
      ) : null}
    </>
  );
}

export const VacationMonthCalendar = memo(function VacationMonthCalendar({
  month,
  showVacationOverview,
  canManageWithPicker,
  canOpenMonthTable,
  isMobile,
  isUpdating,
  availableDoctors,
  openDate,
  pickerSearchTerm,
  selectedDoctorIdsByDate,
  pickerMarkerClassName,
  modifiers,
  modifierClasses,
  vacationsByDate,
  hasPendingByDate,
  onOpenMonthTable,
  onOpenDateChange,
  onPickerSearchTermChange,
  onToggleDoctor,
  onDayClick,
  pickerEnabled,
}: VacationMonthCalendarProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const openDateEntries = openDate ? (vacationsByDate.get(openDate) ?? []) : [];
  const pickerPosition = useAnchoredOverlay({
    anchorKey: openDate,
    anchorRefs: cellRefs,
    wrapperRef,
    isEnabled: canManageWithPicker,
    isMobile,
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
        modifiers={modifiers}
        modifiersClassNames={modifierClasses}
        onDayClick={(day) => {
          if (canManageWithPicker) {
            onOpenDateChange(dayToKey(day));
            return;
          }

          onDayClick(day);
        }}
        components={{
          DayButton: (props: React.ComponentProps<typeof RdpDayButton>) => {
            const { day, modifiers, className, children, ...rest } = props;
            const dayKey = dayToKey(day.date);
            const entries = vacationsByDate.get(dayKey) ?? [];
            const tooltip = getSortedUniqueNames(
              entries.map((entry) => entry.doctorName),
            ).join("\n");
            const colors = Array.from(
              new Set(entries.map((entry) => entry.color)),
            ).sort(compareVacationColors) as DisplayVacationColor[];
            const hasPendingApproval = hasPendingByDate.get(dayKey) ?? false;
            const pendingQuestionMarkClass =
              colors.length > 0
                ? VACATION_COLOR_STYLES[colors[0]].questionMark
                : "text-blue-600";

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
                data-selected-single={
                  modifiers.selected &&
                  !modifiers.range_start &&
                  !modifiers.range_end &&
                  !modifiers.range_middle
                }
                data-range-start={modifiers.range_start}
                data-range-end={modifiers.range_end}
                data-range-middle={modifiers.range_middle}
                title={!isMobile ? tooltip || undefined : undefined}
                className={cn(
                  "relative data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 hover:bg-transparent dark:hover:text-inherit flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] data-[range-end=true]:rounded-md data-[range-end=true]:rounded-r-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md data-[range-start=true]:rounded-l-md [&>span]:text-xs [&>span]:opacity-70",
                  canManageWithPicker && "cursor-pointer",
                  openDate === dayKey && "ring-2 ring-sky-500 ring-offset-1",
                  defaultClassNames.day,
                  className,
                )}
                {...rest}
              >
                {showVacationOverview && colors.length > 0 && (
                  <span className="absolute inset-0 overflow-hidden rounded-md">
                    {colors.map((color, index) => {
                      const segmentHeight = 100 / colors.length;

                      return (
                        <span
                          key={`${dayKey}-${color}`}
                          className={cn(
                            "absolute inset-x-0 opacity-80",
                            VACATION_COLOR_STYLES[color].classes,
                          )}
                          style={{
                            top: `${index * segmentHeight}%`,
                            height: `${segmentHeight}%`,
                          }}
                        />
                      );
                    })}
                  </span>
                )}
                {hasPendingApproval && (
                  <span
                    className={cn(
                      "absolute right-0.5 top-0.5 z-20",
                      pendingQuestionMarkClass,
                    )}
                  >
                    <CircleHelp className="h-3 w-3" />
                  </span>
                )}
                <span className="relative z-10">{children}</span>
              </Button>
            );
          },
        }}
        className="w-full"
      />

      {canManageWithPicker && !isMobile && openDate && pickerPosition ? (
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
              Urlaub
            </div>
            <div className="mt-1 text-sm font-medium">
              {format(new Date(`${openDate}T00:00:00`), "dd.MM.yyyy")}
            </div>
          </div>
          <div className="mb-3">
            <VacationEntryPills entries={openDateEntries} />
          </div>
          {pickerEnabled ? (
            <DoctorPicker
              open={openDate != null}
              doctors={availableDoctors}
              searchTerm={pickerSearchTerm}
              selectedDoctorIds={selectedDoctorIdsByDate.get(openDate) ?? []}
              selectionMarkerClassName={pickerMarkerClassName}
              onSearchTermChange={onPickerSearchTermChange}
              onToggleDoctor={(doctorId) => {
                onToggleDoctor(openDate, doctorId);
              }}
              onClose={() => onOpenDateChange(null)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Wählen Sie zuerst eine Farbe.
            </p>
          )}
        </div>
      ) : null}

      {canManageWithPicker && isMobile ? (
        <Dialog
          open={openDate != null}
          onOpenChange={(isOpen) => !isOpen && onOpenDateChange(null)}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Urlaub</DialogTitle>
              <DialogDescription>
                {openDate
                  ? `Arzte fur ${format(new Date(`${openDate}T00:00:00`), "dd.MM.yyyy")} auswahlen oder entfernen.`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            {openDate ? (
              <div className="relative">
                {isUpdating ? (
                  <Loader2 className="absolute right-0 top-0 size-4 animate-spin text-muted-foreground" />
                ) : null}
                <div className="mb-3">
                  <VacationEntryPills
                    entries={vacationsByDate.get(openDate) ?? []}
                  />
                </div>
                {pickerEnabled ? (
                  <DoctorPicker
                    open={openDate != null}
                    doctors={availableDoctors}
                    searchTerm={pickerSearchTerm}
                    selectedDoctorIds={
                      selectedDoctorIdsByDate.get(openDate) ?? []
                    }
                    selectionMarkerClassName={pickerMarkerClassName}
                    onSearchTermChange={onPickerSearchTermChange}
                    onToggleDoctor={(doctorId) => {
                      onToggleDoctor(openDate, doctorId);
                    }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Wählen Sie zuerst eine Farbe.
                  </p>
                )}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
});
