"use client";

import {
  DoctorPicker,
  type DoctorPickerOption,
} from "@/components/doctor-picker";
import { MonthlySingleColumnTable } from "@/components/shifts/MonthlySingleColumnTable";
import { Button } from "@/components/ui/button";
import { CalendarSkeleton } from "@/components/ui/calendar-skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RealPill } from "@/components/ui/real-pill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useVacationMutations } from "@/components/vacations/useVacationMutations";
import { useAuth } from "@/lib/auth-client";
import { schedulingRange } from "@/lib/dates";
import {
  getAutomaticNightShiftVacationDays,
  type VacationDisplayDay,
} from "@/lib/night-shift-vacations";
import { queryKeys } from "@/lib/query-keys";
import { isAssigner } from "@/lib/roles";
import { useAnchoredOverlay } from "@/lib/use-anchored-overlay";
import { useApiClient } from "@/lib/use-api-client";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import {
  DISPLAY_VACATION_COLORS,
  VACATION_COLOR_STYLES,
  type DisplayVacationColor,
  type VacationColor,
} from "@/lib/vacations";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ALL_DOCTORS_VALUE,
  alphabeticCollator,
  countColors,
  createDisplayColorCountMap,
  dayToKey,
  DEFAULT_DOCTOR_COLOR,
  EMPTY_VACATION_DAYS,
  getDayColors,
  getSortedUniqueNames,
  sortVacationEntries,
  VACATION_TABLE_COLUMN,
  VacationColorControls,
  VacationEntryPills,
  VacationMonthCalendar,
} from "@/components/vacations/VacationCalendar";

export default function VacationsPage() {
  const { user, isLoading } = useAuth();
  const { doctorsApi, shiftsApi, vacationsApi } = useApiClient();
  const doctorId = user?.doctorId ?? null;
  const canApprove = user?.role === "secretary";
  const canViewAllVacations =
    canApprove || isAssigner(user?.role) || user?.role === "doctor";
  const canEditAllVacations = isAssigner(user?.role);
  const canEditOwnVacations = user?.role === "doctor" && doctorId != null;
  const canEditVacations = canEditAllVacations || canEditOwnVacations;
  const canViewVacations = canViewAllVacations;
  const year = new Date().getFullYear();
  const vacationsQueryKey = queryKeys.vacations(year);
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
    queryKey: queryKeys.shifts(schedulingRange(new Date(year, 0, 1), "year")),
    queryFn: () =>
      shiftsApi.getAll(schedulingRange(new Date(year, 0, 1), "year")),
    enabled: canViewVacations,
  });
  const manualVacationDays = data ?? EMPTY_VACATION_DAYS;
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
        (entry) =>
          `${entry.doctorId ?? "unknown"}:${entry.date}:${entry.color}`,
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
  const visibleCalendarVacationDays = useMemo(
    () => vacationDays.filter((entry) => entry.color !== "green"),
    [vacationDays],
  );

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

  const dayColors = useMemo(
    () =>
      Object.fromEntries(
        manualVacationDays
          .filter((entry) => entry.doctorId === editableDoctorId)
          .map((entry) => [entry.date, entry.color]),
      ),
    [editableDoctorId, manualVacationDays],
  );

  const colorCounts = useMemo(() => countColors(dayColors), [dayColors]);

  const { updateMutation, approvalMutation, denyMutation, editDay } =
    useVacationMutations(year, doctors);
  const handleDayClick = useCallback(
    (day: Date) => {
      if (!activeColor || editableDoctorId == null) return;
      const date = dayToKey(day);
      editDay({
        doctorId: editableDoctorId,
        date,
        color: dayColors[date] === activeColor ? null : activeColor,
      });
    },
    [activeColor, editableDoctorId, dayColors, editDay],
  );
  const handleToggleDoctor = useCallback(
    (date: string, value: string) => {
      if (!canEditAllVacations || !activeColor) return;
      const doctorId = Number(value);
      const existing = manualVacationDays.find(
        (entry) => entry.doctorId === doctorId && entry.date === date,
      );
      editDay({
        doctorId,
        date,
        color: existing?.color === activeColor ? null : activeColor,
      });
    },
    [canEditAllVacations, activeColor, manualVacationDays, editDay],
  );

  const visibleVacationDays = useMemo(() => {
    if (selectedDoctorId === ALL_DOCTORS_VALUE) {
      return visibleCalendarVacationDays;
    }

    return visibleCalendarVacationDays.filter(
      (entry) => String(entry.doctorId ?? "unknown") === selectedDoctorId,
    );
  }, [selectedDoctorId, visibleCalendarVacationDays]);

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

    visibleCalendarVacationDays.forEach((entry) => {
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
  }, [canApprove, visibleCalendarVacationDays]);

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
  const activeTableVacationsByDate =
    activeTableMonthIndex >= 0
      ? (vacationsByMonth[activeTableMonthIndex] ?? new Map())
      : new Map<string, VacationDisplayDay[]>();

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
              openDate={
                openDate?.startsWith(format(month, "yyyy-MM")) ? openDate : null
              }
              pickerSearchTerm={pickerSearchTerm}
              selectedDoctorIdsByDate={selectedDoctorIdsByDate}
              pickerMarkerClassName={
                activeColor
                  ? VACATION_COLOR_STYLES[activeColor].classes
                  : undefined
              }
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
                  <div className="mb-3">
                    <VacationEntryPills
                      entries={
                        activeTableVacationsByDate.get(tableOpenDate) ?? []
                      }
                    />
                  </div>
                  {activeColor ? (
                    <DoctorPicker
                      open={tableOpenDate != null}
                      doctors={availableDoctors}
                      searchTerm={pickerSearchTerm}
                      selectedDoctorIds={
                        selectedDoctorIdsByDate.get(tableOpenDate) ?? []
                      }
                      selectionMarkerClassName={
                        activeColor
                          ? VACATION_COLOR_STYLES[activeColor].classes
                          : undefined
                      }
                      onSearchTermChange={setPickerSearchTerm}
                      onToggleDoctor={(doctorId) => {
                        handleToggleDoctor(tableOpenDate, doctorId);
                      }}
                      onClose={() => setTableOpenDate(null)}
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
                <div className="mb-3">
                  <VacationEntryPills
                    entries={
                      activeTableVacationsByDate.get(tableOpenDate) ?? []
                    }
                  />
                </div>
                {activeColor ? (
                  <DoctorPicker
                    open={tableOpenDate != null}
                    doctors={availableDoctors}
                    searchTerm={pickerSearchTerm}
                    selectedDoctorIds={
                      selectedDoctorIdsByDate.get(tableOpenDate) ?? []
                    }
                    selectionMarkerClassName={
                      activeColor
                        ? VACATION_COLOR_STYLES[activeColor].classes
                        : undefined
                    }
                    onSearchTermChange={setPickerSearchTerm}
                    onToggleDoctor={(doctorId) => {
                      handleToggleDoctor(tableOpenDate, doctorId);
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
              <DialogDescription>
                Prüfen Sie die Anträge und genehmigen oder lehnen Sie sie ab.
              </DialogDescription>
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
                          disabled={
                            vacation.isAutomatic ||
                            !vacation.id ||
                            vacation.id < 0 ||
                            approvalMutation.isPending ||
                            denyMutation.isPending
                          }
                          onCheckedChange={(checked) => {
                            if (!vacation.id) return;
                            approvalMutation.mutate({
                              id: vacation.id,
                              expectedColor: vacation.color,
                              approved: checked,
                            });
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={
                            vacation.isAutomatic ||
                            !vacation.id ||
                            vacation.id < 0 ||
                            approvalMutation.isPending ||
                            denyMutation.isPending
                          }
                          onClick={() => {
                            if (!vacation.id) return;
                            denyMutation.mutate({
                              id: vacation.id,
                              expectedColor: vacation.color,
                            });
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
