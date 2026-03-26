"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { CircleHelp, Loader2, Table2 } from "lucide-react";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { CalendarSkeleton } from "@/components/ui/calendar-skeleton";
import { Button } from "@/components/ui/button";
import {
  DoctorPicker,
  type DoctorPickerOption,
} from "@/components/doctor-picker";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-client";
import { type VacationDay } from "@/lib/api";
import { useApiClient } from "@/lib/use-api-client";
import { useAnchoredOverlay } from "@/lib/use-anchored-overlay";
import { useMediaQuery } from "@/lib/use-media-query";
import {
  DISPLAY_VACATION_COLORS,
  VACATION_COLORS,
  VACATION_COLOR_STYLES,
  VACATION_DAYS_PER_YEAR,
  type DisplayVacationColor,
  type VacationColor,
} from "@/lib/vacations";
import { isAssigner } from "@/lib/roles";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getDefaultClassNames,
  DayButton as RdpDayButton,
} from "react-day-picker";
import { MonthlySingleColumnTable } from "@/components/shifts/MonthlySingleColumnTable";
import { RealPill } from "@/components/ui/real-pill";
import {
  type VacationDisplayDay,
  getAutomaticNightShiftVacationDays,
} from "@/lib/night-shift-vacations";

const EMPTY_VACATION_DAYS: VacationDay[] = [];
const ALL_DOCTORS_VALUE = "all";
const DEFAULT_DOCTOR_COLOR = "#64748b";
const alphabeticCollator = new Intl.Collator("de", { sensitivity: "base" });
const VACATION_TABLE_COLUMN = {
  id: "vacation",
  label: "Urlaub",
} as const;

const createColorCountMap = (): Record<VacationColor, number> =>
  VACATION_COLORS.reduce(
    (acc, color) => {
      acc[color] = 0;
      return acc;
    },
    {} as Record<VacationColor, number>,
  );

const createDisplayColorCountMap = (): Record<DisplayVacationColor, number> =>
  DISPLAY_VACATION_COLORS.reduce(
    (acc, color) => {
      acc[color] = 0;
      return acc;
    },
    {} as Record<DisplayVacationColor, number>,
  );

const countColors = (input: Record<string, VacationColor>) => {
  return Object.values(input).reduce((acc, color) => {
    acc[color] += 1;
    return acc;
  }, createColorCountMap());
};

const dayToKey = (day: Date) => format(day, "yyyy-MM-dd");

const getVacationDoctorName = (entry: VacationDisplayDay) =>
  entry.doctorName?.trim() || `Arzt #${entry.doctorId ?? "?"}`;

const compareVacationColors = (
  left: DisplayVacationColor,
  right: DisplayVacationColor,
) =>
  alphabeticCollator.compare(
    VACATION_COLOR_STYLES[left].label,
    VACATION_COLOR_STYLES[right].label,
  );

const sortVacationEntries = (entries: VacationDisplayDay[]) => {
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

const getSortedUniqueNames = (names: Array<string | null | undefined>) => {
  return Array.from(
    new Set(
      names
        .map((name) => name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ).sort((left, right) => alphabeticCollator.compare(left, right));
};

const getDayColors = (entries: VacationDisplayDay[]) => {
  const map = new Map<string, VacationDisplayDay[]>();
  entries.forEach((entry) => {
    const list = map.get(entry.date) ?? [];
    list.push(entry);
    map.set(entry.date, sortVacationEntries(list));
  });
  return map;
};

type VacationMonthCalendarProps = {
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

type VacationColorControlsProps = {
  canEditAllVacations: boolean;
  canUseVacationEditor: boolean;
  activeColor: VacationColor | null;
  colorCounts: Record<VacationColor, number>;
  onColorSelect: (color: VacationColor) => void;
};

function VacationColorControls({
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

const VacationMonthCalendar = memo(function VacationMonthCalendar({
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
            const colors = Array.from(new Set(entries.map((entry) => entry.color))).sort(
              compareVacationColors,
            ) as DisplayVacationColor[];
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
          {pickerEnabled ? (
            <DoctorPicker
              open={openDate != null}
              doctors={availableDoctors}
              searchTerm={pickerSearchTerm}
              selectedDoctorIds={selectedDoctorIdsByDate.get(openDate) ?? []}
              onSearchTermChange={onPickerSearchTermChange}
              onToggleDoctor={(doctorId) => {
                onToggleDoctor(openDate, doctorId);
                onOpenDateChange(null);
              }}
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
                {pickerEnabled ? (
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
                      onOpenDateChange(null);
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

export default function VacationsPage() {
  const { user, isLoading } = useAuth();
  const { doctorsApi, shiftsApi, vacationsApi } = useApiClient();
  const queryClient = useQueryClient();
  const doctorId = user?.doctorId ?? null;
  const canApprove = user?.role === "secretary";
  const canViewAllVacations =
    canApprove || isAssigner(user?.role) || user?.role === "doctor";
  const canEditAllVacations = isAssigner(user?.role);
  const canEditOwnVacations = user?.role === "doctor" && doctorId != null;
  const canEditVacations = canEditAllVacations || canEditOwnVacations;
  const canViewVacations = canViewAllVacations;
  const year = new Date().getFullYear();
  const vacationsQueryKey = useMemo(
    () => [
      "vacations",
      canViewAllVacations ? ALL_DOCTORS_VALUE : doctorId,
      year,
    ],
    [canViewAllVacations, doctorId, year],
  );

  const { data: doctors = [], isLoading: isDoctorsLoading } = useQuery({
    queryKey: ["doctors"],
    queryFn: doctorsApi.getAll,
    enabled: canViewVacations,
  });

  const { data, isLoading: isVacationsLoading } = useQuery({
    queryKey: vacationsQueryKey,
    queryFn: () => vacationsApi.getByYear(year),
    enabled: canViewVacations,
  });
  const { data: allShifts = [] } = useQuery({
    queryKey: ["shifts"],
    queryFn: shiftsApi.getAll,
    enabled: canViewVacations,
  });
  const [optimisticVacationDays, setOptimisticVacationDays] = useState<
    VacationDay[] | null
  >(null);
  const manualVacationDays = optimisticVacationDays ?? data ?? EMPTY_VACATION_DAYS;
  const automaticVacationDays = useMemo(
    () =>
      getAutomaticNightShiftVacationDays(allShifts, doctors).filter((entry) =>
        entry.date.startsWith(`${year}-`),
      ),
    [allShifts, doctors, year],
  );
  const vacationDays = useMemo(() => {
    const manualDayKeys = new Set(
      manualVacationDays.map(
        (entry) => `${entry.doctorId ?? "unknown"}:${entry.date}:${entry.color}`,
      ),
    );

    return [
      ...manualVacationDays,
      ...automaticVacationDays.filter(
        (entry) =>
          !manualDayKeys.has(
            `${entry.doctorId ?? "unknown"}:${entry.date}:${entry.color}`,
          ),
      ),
    ] as VacationDisplayDay[];
  }, [automaticVacationDays, manualVacationDays]);

  const [dayColors, setDayColors] = useState<Record<string, VacationColor>>({});
  const [activeColor, setActiveColor] = useState<VacationColor | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] =
    useState<string>(ALL_DOCTORS_VALUE);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [pickerSearchTerm, setPickerSearchTerm] = useState("");
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [tableMonth, setTableMonth] = useState<Date | null>(null);
  const [tableOpenDate, setTableOpenDate] = useState<string | null>(null);
  const hasInitializedDoctorSelection = useRef(false);
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const tableCellRefs = useRef(new Map<string, HTMLTableCellElement>());

  const filteredDoctorId =
    selectedDoctorId === ALL_DOCTORS_VALUE ? null : Number(selectedDoctorId);

  const editableDoctorId = canEditAllVacations
    ? filteredDoctorId
    : canEditOwnVacations && filteredDoctorId === doctorId
      ? doctorId
      : null;
  const canUseVacationEditor = canEditAllVacations || editableDoctorId != null;
  const isPickerMode =
    canEditAllVacations && selectedDoctorId === ALL_DOCTORS_VALUE;
  const tablePickerPosition = useAnchoredOverlay({
    anchorKey: tableOpenDate,
    anchorRefs: tableCellRefs,
    wrapperRef: tableWrapperRef,
    isEnabled: tableMonth != null && isPickerMode,
    isMobile,
    recalculateKey: `${tableMonth?.getTime() ?? ""}:${pickerSearchTerm}`,
    onRequestClose: () => setTableOpenDate(null),
  });

  const isOverviewMode = canApprove || editableDoctorId == null;

  useEffect(() => {
    setOptimisticVacationDays(null);
  }, [data]);

  useEffect(() => {
    setPickerSearchTerm("");
  }, [openDate, tableOpenDate]);

  useEffect(() => {
    if (!tableMonth) {
      setTableOpenDate(null);
    }
  }, [tableMonth]);

  useEffect(() => {
    if (user?.role !== "doctor" || doctorId == null) {
      hasInitializedDoctorSelection.current = false;
      return;
    }

    if (hasInitializedDoctorSelection.current) {
      return;
    }

    hasInitializedDoctorSelection.current = true;
    if (selectedDoctorId === ALL_DOCTORS_VALUE) {
      setSelectedDoctorId(String(doctorId));
    }
  }, [doctorId, selectedDoctorId, user?.role]);

  useEffect(() => {
    if (editableDoctorId == null) {
      setDayColors({});
      return;
    }

    const next = manualVacationDays.reduce<Record<string, VacationColor>>(
      (acc, entry) => {
        if (entry.doctorId !== editableDoctorId) {
          return acc;
        }

        acc[entry.date] = entry.color;
        return acc;
      },
      {},
    );
    setDayColors(next);
  }, [editableDoctorId, manualVacationDays]);

  const colorCounts = useMemo(() => countColors(dayColors), [dayColors]);

  const updateMutation = useMutation({
    mutationFn: ({
      doctorId,
      days,
    }: {
      doctorId: number;
      days: VacationDay[];
    }) => vacationsApi.updateYear(year, days, doctorId),
    onSuccess: () => {
      console.log("synced");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: vacationsQueryKey });
      queryClient.invalidateQueries({
        queryKey: ["vacations", "calendar", year],
      });
    },
  });

  const invalidateVacationsQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: vacationsQueryKey });
    queryClient.invalidateQueries({
      queryKey: ["vacations", "calendar", year],
    });
  }, [queryClient, vacationsQueryKey, year]);

  const approvalMutation = useMutation({
    mutationFn: ({ id, approved }: { id: number; approved: boolean }) =>
      vacationsApi.updateApproval(id, approved),
    onMutate: async ({ id, approved }) => {
      await queryClient.cancelQueries({ queryKey: vacationsQueryKey });

      const previousVacationDays =
        queryClient.getQueryData<VacationDay[]>(vacationsQueryKey) ?? [];

      queryClient.setQueryData<VacationDay[]>(
        vacationsQueryKey,
        previousVacationDays.map((entry) =>
          entry.id === id ? { ...entry, approved } : entry,
        ),
      );

      return { previousVacationDays };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousVacationDays) {
        queryClient.setQueryData(
          vacationsQueryKey,
          context.previousVacationDays,
        );
      }
    },
    onSuccess: () => {
      console.log("synced");
    },
    onSettled: () => {
      invalidateVacationsQueries();
    },
  });

  const denyMutation = useMutation({
    mutationFn: (id: number) => vacationsApi.deny(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: vacationsQueryKey });

      const previousVacationDays =
        queryClient.getQueryData<VacationDay[]>(vacationsQueryKey) ?? [];

      queryClient.setQueryData<VacationDay[]>(
        vacationsQueryKey,
        previousVacationDays.filter((entry) => entry.id !== id),
      );

      return { previousVacationDays };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousVacationDays) {
        queryClient.setQueryData(
          vacationsQueryKey,
          context.previousVacationDays,
        );
      }
    },
    onSuccess: () => {
      console.log("synced");
    },
    onSettled: () => {
      invalidateVacationsQueries();
    },
  });

  const persistDays = useCallback(
    (nextMap: Record<string, VacationColor>) => {
      if (editableDoctorId == null) {
        return;
      }

      const payload: VacationDay[] = Object.entries(nextMap).map(
        ([date, color]) => ({ date, color }),
      );
      updateMutation.mutate({ doctorId: editableDoctorId, days: payload });
    },
    [editableDoctorId, updateMutation],
  );

  const handleDayClick = useCallback(
    (day: Date) => {
      if (!activeColor || editableDoctorId == null) return;
      const key = dayToKey(day);

      const existing = dayColors[key];
      const counts = countColors(dayColors);
      const yearlyLimit = VACATION_DAYS_PER_YEAR[activeColor];
      const isUnlimited = !Number.isFinite(yearlyLimit);
      const remaining = isUnlimited
        ? Number.POSITIVE_INFINITY
        : yearlyLimit -
          counts[activeColor] +
          (existing === activeColor ? 1 : 0);
      if (existing !== activeColor && remaining <= 0) {
        toast.error(
          `${VACATION_COLOR_STYLES[activeColor].label} ist bereits vollständig verbraucht.`,
        );
        return;
      }

      const next = { ...dayColors };
      if (existing === activeColor) {
        delete next[key];
      } else {
        next[key] = activeColor;
      }

      flushSync(() => {
        setDayColors(next);
      });

      requestAnimationFrame(() => {
        persistDays(next);
      });
    },
    [activeColor, dayColors, editableDoctorId, persistDays],
  );

  const handleToggleDoctor = useCallback(
    (date: string, doctorIdToToggle: string) => {
      if (!canEditAllVacations || !activeColor) {
        return;
      }

      const parsedDoctorId = Number(doctorIdToToggle);
      if (!Number.isInteger(parsedDoctorId)) {
        return;
      }

      const existingEntry = manualVacationDays.find(
        (entry) =>
          entry.date === date &&
          entry.doctorId === parsedDoctorId &&
          entry.color === activeColor,
      );
      const activeColorEntriesForDate = manualVacationDays.filter(
        (entry) => entry.date === date && entry.color === activeColor,
      );
      const yearlyLimit = VACATION_DAYS_PER_YEAR[activeColor];
      const isUnlimited = !Number.isFinite(yearlyLimit);
      const usedDays = manualVacationDays.reduce((count, entry) => {
        if (
          entry.doctorId === parsedDoctorId &&
          entry.color === activeColor &&
          entry.date !== date
        ) {
          return count + 1;
        }

        return count;
      }, 0);

      if (!isUnlimited && !existingEntry && usedDays >= yearlyLimit) {
        toast.error(
          `${VACATION_COLOR_STYLES[activeColor].label} ist für diesen Arzt bereits vollständig verbraucht.`,
        );
        return;
      }

      const doctor = doctors.find(
        (entry) => String(entry.id) === doctorIdToToggle,
      );
      const affectedDoctorIds = Array.from(
        new Set(
          activeColorEntriesForDate
            .map((entry) => entry.doctorId)
            .filter((entry): entry is number => typeof entry === "number")
            .concat(parsedDoctorId),
        ),
      );
      const nextVacationDays = (() => {
        if (existingEntry) {
          return manualVacationDays.filter(
            (entry) =>
              !(
                entry.date === date &&
                entry.doctorId === parsedDoctorId &&
                entry.color === activeColor
              ),
          );
        }

        const nextEntry: VacationDay = {
          doctorId: parsedDoctorId,
          doctorName: doctor?.name ?? `Arzt #${parsedDoctorId}`,
          date,
          color: activeColor,
          approved: false,
        };

        const filtered = manualVacationDays.filter(
          (entry) =>
            !(entry.date === date && entry.doctorId === parsedDoctorId),
        );

        return [...filtered, nextEntry].sort((left, right) => {
          const dateComparison = left.date.localeCompare(right.date);
          if (dateComparison !== 0) {
            return dateComparison;
          }

          return (left.doctorId ?? 0) - (right.doctorId ?? 0);
        });
      })();

      flushSync(() => {
        setOptimisticVacationDays(nextVacationDays);
      });

      requestAnimationFrame(() => {
        affectedDoctorIds.forEach((affectedDoctorId) => {
          const affectedPayload = nextVacationDays
            .filter((entry) => entry.doctorId === affectedDoctorId)
            .map(({ date: vacationDate, color }) => ({
              date: vacationDate,
              color,
            }));

          updateMutation.mutate({
            doctorId: affectedDoctorId,
            days: affectedPayload,
          });
        });
      });
    },
    [activeColor, canEditAllVacations, doctors, manualVacationDays, updateMutation],
  );

  const visibleVacationDays = useMemo(() => {
    if (selectedDoctorId === ALL_DOCTORS_VALUE) {
      return vacationDays;
    }

    return vacationDays.filter(
      (entry) => String(entry.doctorId ?? "unknown") === selectedDoctorId,
    );
  }, [selectedDoctorId, vacationDays]);

  const vacationsByDate = useMemo(() => {
    return getDayColors(visibleVacationDays);
  }, [visibleVacationDays]);

  const selectedVacations = useMemo<VacationDisplayDay[]>(() => {
    if (!selectedDate || !canApprove) return [] as VacationDisplayDay[];
    return vacationsByDate.get(selectedDate) ?? [];
  }, [canApprove, selectedDate, vacationsByDate]);

  const hasPendingByDate = useMemo(() => {
    const next = new Map<string, boolean>();
    vacationsByDate.forEach((entries, date) => {
      const hasPending = entries.some((entry) => !entry.approved);
      next.set(date, hasPending);
    });
    return next;
  }, [vacationsByDate]);

  const availableDoctors = useMemo<DoctorPickerOption[]>(() => {
    const next = new Map<string, DoctorPickerOption>();

    doctors.forEach((doctor) => {
      next.set(String(doctor.id), {
        id: String(doctor.id),
        name: doctor.name,
        color:
          typeof doctor.color === "string" && doctor.color.trim() !== ""
            ? doctor.color
            : DEFAULT_DOCTOR_COLOR,
      });
    });

    manualVacationDays.forEach((entry) => {
      const doctorId = String(entry.doctorId ?? "unknown");
      const doctorName = entry.doctorName ?? `Arzt #${entry.doctorId ?? "?"}`;
      if (!next.has(doctorId)) {
        next.set(doctorId, {
          id: doctorId,
          name: doctorName,
          color: DEFAULT_DOCTOR_COLOR,
        });
      }
    });

    return Array.from(next.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [doctors, manualVacationDays]);

  const doctorNameById = useMemo(
    () => new Map(availableDoctors.map((doctor) => [doctor.id, doctor.name])),
    [availableDoctors],
  );

  useEffect(() => {
    if (!canViewVacations) {
      return;
    }
    if (isDoctorsLoading || availableDoctors.length === 0) {
      return;
    }

    if (selectedDoctorId === ALL_DOCTORS_VALUE) {
      return;
    }

    const exists = availableDoctors.some(
      (doctor) => doctor.id === selectedDoctorId,
    );
    if (!exists) {
      setSelectedDoctorId(ALL_DOCTORS_VALUE);
    }
  }, [availableDoctors, canViewVacations, isDoctorsLoading, selectedDoctorId]);

  const selectedDoctorIdsByDate = useMemo(() => {
    const next = new Map<string, string[]>();

    if (!activeColor) {
      return next;
    }

    manualVacationDays.forEach((entry) => {
      if (entry.color !== activeColor || typeof entry.doctorId !== "number") {
        return;
      }

      const current = next.get(entry.date) ?? [];
      const doctorId = String(entry.doctorId);
      if (!current.includes(doctorId)) {
        current.push(doctorId);
      }
      next.set(
        entry.date,
        current.sort((left, right) =>
          alphabeticCollator.compare(
            doctorNameById.get(left) ?? left,
            doctorNameById.get(right) ?? right,
          ),
        ),
      );
    });

    return next;
  }, [activeColor, doctorNameById, manualVacationDays]);

  const approverStats = useMemo(() => {
    if (!canApprove) {
      return {
        approved: 0,
        unapproved: 0,
          doctors: [] as Array<{
            key: string;
            doctorName: string;
            approved: Record<DisplayVacationColor, number>;
            unapproved: Record<DisplayVacationColor, number>;
          }>,
        };
    }

    const byDoctor = new Map<
      string,
        {
          key: string;
          doctorName: string;
          approved: Record<DisplayVacationColor, number>;
          unapproved: Record<DisplayVacationColor, number>;
        }
      >();

    let approved = 0;
    let unapproved = 0;

    vacationDays.forEach((entry) => {
      const key = `${entry.doctorId ?? "unknown"}`;
      const doctorName = entry.doctorName ?? `Arzt #${entry.doctorId ?? "?"}`;
      const existing =
        byDoctor.get(key) ??
        ({
          key,
          doctorName,
          approved: createDisplayColorCountMap(),
          unapproved: createDisplayColorCountMap(),
        } as {
          key: string;
          doctorName: string;
          approved: Record<DisplayVacationColor, number>;
          unapproved: Record<DisplayVacationColor, number>;
        });

      if (entry.approved) {
        approved += 1;
        existing.approved[entry.color] += 1;
      } else {
        unapproved += 1;
        existing.unapproved[entry.color] += 1;
      }

      byDoctor.set(key, existing);
    });

    const doctors = Array.from(byDoctor.values()).sort((a, b) =>
      a.doctorName.localeCompare(b.doctorName),
    );

    return {
      approved,
      unapproved,
      doctors,
    };
  }, [canApprove, vacationDays]);

  const modifiers = useMemo(() => {
    const byColor = DISPLAY_VACATION_COLORS.reduce(
      (acc, color) => {
        acc[color] = [];
        return acc;
      },
      {} as Record<DisplayVacationColor, Date[]>,
    );
    visibleVacationDays.forEach((entry) => {
      byColor[entry.color].push(parseISO(entry.date));
    });
    return byColor;
  }, [visibleVacationDays]);

  const modifierClasses = useMemo(() => {
    return DISPLAY_VACATION_COLORS.reduce(
      (acc, color) => {
        acc[color] = cn(VACATION_COLOR_STYLES[color].classes, "rounded-md");
        return acc;
      },
      {} as Record<DisplayVacationColor, string>,
    );
  }, []);

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, index) => new Date(year, index, 1)),
    [year],
  );

  const monthSpecificModifiers = useMemo(() => {
    if (isOverviewMode) {
      return months.map(() => undefined);
    }

    return months.map((month) => {
      const prefix = format(month, "yyyy-MM");
      return DISPLAY_VACATION_COLORS.reduce(
        (acc, color) => {
          acc[color] = (modifiers[color] ?? []).filter((date) =>
            format(date, "yyyy-MM").startsWith(prefix),
          );
          return acc;
        },
        {} as Record<DisplayVacationColor, Date[]>,
      );
    });
  }, [isOverviewMode, modifiers, months]);

  const vacationsByMonth = useMemo(() => {
    return months.map((month) => {
      const prefix = format(month, "yyyy-MM");
      const next = new Map<string, VacationDisplayDay[]>();

      vacationsByDate.forEach((entries, date) => {
        if (date.startsWith(prefix)) {
          next.set(date, entries);
        }
      });

      return next;
    });
  }, [months, vacationsByDate]);

  const tableValuesByMonth = useMemo(() => {
    return vacationsByMonth.map((byDate) => {
      const next = new Map<
        string,
        {
          text: string;
          title?: string;
          className?: string;
          content?: React.ReactNode;
        }
      >();

      byDate.forEach((entries, date) => {
        const sortedEntries = sortVacationEntries(entries);
        const names = getSortedUniqueNames(
          sortedEntries.map((entry) => entry.doctorName),
        );

        next.set(date, {
          text: names.join("/"),
          title: names.join("\n") || undefined,
          className: "py-1.5 align-top",
          content: (
            <div className="flex flex-wrap justify-center gap-1">
              {sortedEntries.map((entry) => {
                const doctorKey = String(
                  entry.doctorId ?? entry.doctorName ?? date,
                );
                const doctorName =
                  entry.doctorName ??
                  (typeof entry.doctorId === "number"
                    ? (doctorNameById.get(String(entry.doctorId)) ??
                      `Arzt #${entry.doctorId}`)
                    : "Arzt");

                return (
                  <RealPill
                    key={`${date}-${doctorKey}-${entry.color}`}
                    className={cn(
                      "max-w-full",
                      VACATION_COLOR_STYLES[entry.color].classes,
                    )}
                    title={`${doctorName} - ${VACATION_COLOR_STYLES[entry.color].label}`}
                  >
                    <span className="truncate">{doctorName}</span>
                  </RealPill>
                );
              })}
            </div>
          ),
        });
      });

      return next;
    });
  }, [doctorNameById, vacationsByMonth]);

  const activeTableMonthIndex = tableMonth ? tableMonth.getMonth() : -1;
  const activeTableValues =
    activeTableMonthIndex >= 0
      ? (tableValuesByMonth[activeTableMonthIndex] ?? new Map())
      : new Map<string, { text: string; title?: string }>();

  const pendingByMonth = useMemo(() => {
    return months.map((month) => {
      const prefix = format(month, "yyyy-MM");
      const next = new Map<string, boolean>();

      hasPendingByDate.forEach((hasPending, date) => {
        if (date.startsWith(prefix)) {
          next.set(date, hasPending);
        }
      });

      return next;
    });
  }, [hasPendingByDate, months]);

  if (isLoading) {
    return <div className="text-center">Lädt...</div>;
  }

  if (!canViewVacations) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Urlaub</h2>
        <p className="text-sm text-muted-foreground">
          Sie müssen einem Arzt zugewiesen sein, um Urlaubstage zu verwalten.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-2xl font-semibold">Urlaub</h2>
          <p className="text-sm text-muted-foreground">
            {canApprove
              ? "Klicken Sie auf einen Tag, um Urlaubsfreigaben zu prüfen."
              : isPickerMode
                ? "Wählen Sie eine Farbe, klicken Sie auf einen Tag und wählen Sie dann Ärzte aus."
                : editableDoctorId == null
                  ? "Wählen Sie einen Arzt aus, um Urlaub zu sehen. Zum Bearbeiten wählen Sie sich selbst aus."
                  : `Wählen Sie eine Farbe und klicken Sie dann auf Tage, um Urlaub für ${year} zu markieren.`}
          </p>
        </div>
        {canEditVacations && (
          <>
            <VacationColorControls
              canEditAllVacations={canEditAllVacations}
              canUseVacationEditor={canUseVacationEditor}
              activeColor={activeColor}
              colorCounts={colorCounts}
              onColorSelect={setActiveColor}
            />
          </>
        )}
      </div>

      {canApprove && (
        <details className="max-w-sm rounded-md border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            Genehmigt: {approverStats.approved} | Nicht genehmigt:{" "}
            {approverStats.unapproved}
          </summary>
          <div className="border-t px-4 py-3">
            {approverStats.doctors.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Urlaubsdaten vorhanden.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-2 font-medium">Arzt</th>
                       {DISPLAY_VACATION_COLORS.map((color) => (
                        <th
                          key={`header-${color}`}
                          className="py-2 pr-2 font-medium"
                        >
                          {VACATION_COLOR_STYLES[color].label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {approverStats.doctors.map((doctor) => (
                      <tr
                        key={doctor.key}
                        className="border-b last:border-0 align-top"
                      >
                        <td className="py-2 pr-2 font-medium">
                          {doctor.doctorName}
                        </td>
                         {DISPLAY_VACATION_COLORS.map((color) => (
                          <td
                            key={`${doctor.key}-${color}`}
                            className="py-2 pr-2"
                          >
                            {doctor.approved[color]}/
                            {doctor.approved[color] + doctor.unapproved[color]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>
      )}

      {canViewVacations && (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedDoctorId}
            onValueChange={setSelectedDoctorId}
            disabled={availableDoctors.length === 0}
          >
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Arzt auswählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_DOCTORS_VALUE}>Alle Ärzte</SelectItem>
              {availableDoctors.map((doctor) => (
                <SelectItem key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {months.map((month, index) =>
          !isVacationsLoading ? (
            <VacationMonthCalendar
              key={month.toISOString()}
              month={month}
              showVacationOverview={isOverviewMode}
              canManageWithPicker={isPickerMode}
              canOpenMonthTable={canViewVacations}
              isMobile={isMobile}
              isUpdating={updateMutation.isPending}
              availableDoctors={availableDoctors}
              openDate={openDate}
              pickerSearchTerm={pickerSearchTerm}
              selectedDoctorIdsByDate={selectedDoctorIdsByDate}
              modifiers={monthSpecificModifiers[index]}
              modifierClasses={modifierClasses}
              vacationsByDate={vacationsByMonth[index] ?? new Map()}
              hasPendingByDate={pendingByMonth[index] ?? new Map()}
              onOpenMonthTable={(selectedMonth) => {
                setOpenDate(null);
                setTableOpenDate(null);
                setTableMonth(selectedMonth);
              }}
              onOpenDateChange={setOpenDate}
              onPickerSearchTermChange={setPickerSearchTerm}
              onToggleDoctor={handleToggleDoctor}
              onDayClick={(day) => {
                if (canApprove) {
                  const key = dayToKey(day);
                  setSelectedDate(key);
                  setIsDialogOpen(true);
                } else {
                  handleDayClick(day);
                }
              }}
              pickerEnabled={activeColor != null}
            />
          ) : (
            <div key={month.toISOString()} className="rounded-md border">
              <CalendarSkeleton />
            </div>
          ),
        )}
      </div>

      <Dialog
        open={tableMonth != null}
        onOpenChange={(open) => {
          if (!open) {
            setTableMonth(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Monatstabelle Urlaub</DialogTitle>
            <DialogDescription>
              {tableMonth
                ? format(tableMonth, "MMMM yyyy", { locale: de })
                : ""}
            </DialogDescription>
          </DialogHeader>
          {canEditVacations ? (
            <div className="space-y-2">
              <VacationColorControls
                canEditAllVacations={canEditAllVacations}
                canUseVacationEditor={canUseVacationEditor}
                activeColor={activeColor}
                colorCounts={colorCounts}
                onColorSelect={setActiveColor}
              />
            </div>
          ) : null}
          {tableMonth ? (
            <MonthlySingleColumnTable
              month={tableMonth}
              column={VACATION_TABLE_COLUMN}
              valuesByDate={activeTableValues}
              selectedDateKey={tableOpenDate}
              wrapperRef={tableWrapperRef}
              cellRefs={tableCellRefs}
              containerClassName="max-h-[70vh]"
              onCellClick={
                canApprove || isPickerMode || editableDoctorId != null
                  ? (day) => {
                      const key = dayToKey(day);

                      if (canApprove) {
                        setSelectedDate(key);
                        setTableMonth(null);
                        setIsDialogOpen(true);
                        return;
                      }

                      if (isPickerMode) {
                        setTableOpenDate(key);
                        return;
                      }

                      handleDayClick(day);
                    }
                  : undefined
              }
            >
              {isPickerMode &&
              !isMobile &&
              tableOpenDate &&
              tablePickerPosition ? (
                <div
                  className="pointer-events-auto absolute z-30 overflow-hidden rounded-lg border bg-background p-3 shadow-xl"
                  style={{
                    top: tablePickerPosition.top,
                    left: tablePickerPosition.left,
                    minWidth: tablePickerPosition.minWidth,
                  }}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="absolute right-3 top-3 size-4 animate-spin text-muted-foreground" />
                  ) : null}
                  <div className="mb-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Urlaub
                    </div>
                    <div className="mt-1 text-sm font-medium">
                      {format(
                        new Date(`${tableOpenDate}T00:00:00`),
                        "dd.MM.yyyy",
                      )}
                    </div>
                  </div>
                  {activeColor ? (
                    <DoctorPicker
                      open={tableOpenDate != null}
                      doctors={availableDoctors}
                      searchTerm={pickerSearchTerm}
                      selectedDoctorIds={
                        selectedDoctorIdsByDate.get(tableOpenDate) ?? []
                      }
                      onSearchTermChange={setPickerSearchTerm}
                      onToggleDoctor={(doctorId) => {
                        handleToggleDoctor(tableOpenDate, doctorId);
                        setTableOpenDate(null);
                      }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Wählen Sie zuerst eine Farbe.
                    </p>
                  )}
                </div>
              ) : null}
            </MonthlySingleColumnTable>
          ) : null}
        </DialogContent>
      </Dialog>

      {isVacationsLoading && (
        <p className="text-sm text-muted-foreground">
          Urlaubsdaten werden geladen...
        </p>
      )}
      {isDoctorsLoading && (
        <p className="text-sm text-muted-foreground">
          Ärztedaten werden geladen...
        </p>
      )}
      {updateMutation.isPending && (
        <p className="text-sm text-muted-foreground">
          Änderungen werden gespeichert...
        </p>
      )}
      {canApprove && approvalMutation.isPending && (
        <p className="text-sm text-muted-foreground">
          Freigabe wird aktualisiert...
        </p>
      )}
      {canApprove && denyMutation.isPending && (
        <p className="text-sm text-muted-foreground">
          Urlaub wird abgelehnt...
        </p>
      )}
      {isPickerMode && isMobile ? (
        <Dialog
          open={tableOpenDate != null}
          onOpenChange={(open) => {
            if (!open) {
              setTableOpenDate(null);
            }
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Urlaub</DialogTitle>
              <DialogDescription>
                {tableOpenDate
                  ? `Arzte fur ${format(new Date(`${tableOpenDate}T00:00:00`), "dd.MM.yyyy")} auswahlen oder entfernen.`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            {tableOpenDate ? (
              <div className="relative">
                {updateMutation.isPending ? (
                  <Loader2 className="absolute right-0 top-0 size-4 animate-spin text-muted-foreground" />
                ) : null}
                {activeColor ? (
                  <DoctorPicker
                    open={tableOpenDate != null}
                    doctors={availableDoctors}
                    searchTerm={pickerSearchTerm}
                    selectedDoctorIds={
                      selectedDoctorIdsByDate.get(tableOpenDate) ?? []
                    }
                    onSearchTermChange={setPickerSearchTerm}
                    onToggleDoctor={(doctorId) => {
                      handleToggleDoctor(tableOpenDate, doctorId);
                      setTableOpenDate(null);
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
      {canApprove && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Urlaubsfreigaben</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {selectedDate}
              </div>
              {selectedVacations.length === 0 ? (
                <div className="text-sm">Kein Urlaub für diesen Tag.</div>
              ) : (
                <div className="space-y-3">
                  {selectedVacations.map((vacation) => (
                    <div
                      key={
                        vacation.id ?? `${vacation.doctorId}-${vacation.date}`
                      }
                      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "h-3 w-3 rounded-full",
                            VACATION_COLOR_STYLES[vacation.color].classes,
                          )}
                        />
                        <div className="text-sm">
                          {vacation.doctorName ?? `Arzt #${vacation.doctorId}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {vacation.isAutomatic
                            ? "Automatisch"
                            : vacation.approved
                              ? "Genehmigt"
                              : "Ausstehend"}
                        </span>
                        <Switch
                          checked={!!vacation.approved}
                          disabled={vacation.isAutomatic || !vacation.id}
                          onCheckedChange={(checked) => {
                            if (!vacation.id) return;
                            approvalMutation.mutate({
                              id: vacation.id,
                              approved: checked,
                            });
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={vacation.isAutomatic || !vacation.id}
                          onClick={() => {
                            if (!vacation.id) return;
                            denyMutation.mutate(vacation.id);
                          }}
                        >
                          Ablehnen
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
