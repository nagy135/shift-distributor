"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { CalendarSkeleton } from "@/components/ui/calendar-skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-client";
import { type VacationDay } from "@/lib/api";
import { useApiClient } from "@/lib/use-api-client";
import {
  VACATION_COLORS,
  VACATION_COLOR_STYLES,
  VACATION_DAYS_PER_YEAR,
  type VacationColor,
} from "@/lib/vacations";
import {
  Dialog,
  DialogContent,
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

const EMPTY_VACATION_DAYS: VacationDay[] = [];

const createColorCountMap = (): Record<VacationColor, number> =>
  VACATION_COLORS.reduce(
    (acc, color) => {
      acc[color] = 0;
      return acc;
    },
    {} as Record<VacationColor, number>,
  );

const countColors = (input: Record<string, VacationColor>) => {
  return Object.values(input).reduce((acc, color) => {
    acc[color] += 1;
    return acc;
  }, createColorCountMap());
};

const dayToKey = (day: Date) => format(day, "yyyy-MM-dd");

const getDayColors = (entries: VacationDay[]) => {
  const map = new Map<string, VacationDay[]>();
  entries.forEach((entry) => {
    const list = map.get(entry.date) ?? [];
    list.push(entry);
    map.set(entry.date, list);
  });
  return map;
};

export default function VacationsPage() {
  const { user, isLoading } = useAuth();
  const { vacationsApi } = useApiClient();
  const queryClient = useQueryClient();
  const doctorId = user?.doctorId ?? null;
  const isApprover = user?.role === "secretary";
  const year = new Date().getFullYear();

  const { data, isLoading: isVacationsLoading } = useQuery({
    queryKey: ["vacations", isApprover ? "all" : doctorId, year],
    queryFn: () => vacationsApi.getByYear(year),
    enabled: isApprover || !!doctorId,
  });
  const vacationDays = data ?? EMPTY_VACATION_DAYS;

  const [dayColors, setDayColors] = useState<Record<string, VacationColor>>({});
  const [activeColor, setActiveColor] = useState<VacationColor | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("all");

  useEffect(() => {
    if (isApprover) return;
    const next = vacationDays.reduce<Record<string, VacationColor>>(
      (acc, entry) => {
        acc[entry.date] = entry.color;
        return acc;
      },
      {},
    );
    setDayColors(next);
  }, [vacationDays, isApprover]);

  const colorCounts = useMemo(() => countColors(dayColors), [dayColors]);

  const updateMutation = useMutation({
    mutationFn: (days: VacationDay[]) => vacationsApi.updateYear(year, days),
  });

  const invalidateVacationsQueries = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["vacations", isApprover ? "all" : doctorId, year],
    });
    queryClient.invalidateQueries({ queryKey: ["vacations"] });
  }, [doctorId, isApprover, queryClient, year]);

  const approvalMutation = useMutation({
    mutationFn: ({ id, approved }: { id: number; approved: boolean }) =>
      vacationsApi.updateApproval(id, approved),
    onSuccess: () => {
      invalidateVacationsQueries();
    },
  });

  const denyMutation = useMutation({
    mutationFn: (id: number) => vacationsApi.deny(id),
    onSuccess: () => {
      invalidateVacationsQueries();
    },
  });

  const persistDays = useCallback(
    (nextMap: Record<string, VacationColor>) => {
      const payload: VacationDay[] = Object.entries(nextMap).map(
        ([date, color]) => ({ date, color }),
      );
      updateMutation.mutate(payload);
    },
    [updateMutation],
  );

  const handleDayClick = useCallback(
    (day: Date) => {
      if (!activeColor) return;
      const key = dayToKey(day);

      setDayColors((current) => {
        const existing = current[key];
        const counts = countColors(current);
        const yearlyLimit = VACATION_DAYS_PER_YEAR[activeColor];
        const remaining =
          yearlyLimit -
          counts[activeColor] +
          (existing === activeColor ? 1 : 0);
        if (existing !== activeColor && remaining <= 0) {
          return current;
        }

        const next = { ...current };
        if (existing === activeColor) {
          delete next[key];
        } else {
          next[key] = activeColor;
        }

        persistDays(next);
        return next;
      });
    },
    [activeColor, persistDays],
  );

  const vacationsByDate = useMemo(() => {
    if (!isApprover) {
      return new Map<string, VacationDay[]>();
    }

    const filtered = vacationDays.filter(
      (entry) =>
        selectedDoctorId === "all" ||
        String(entry.doctorId ?? "unknown") === selectedDoctorId,
    );

    return getDayColors(filtered);
  }, [isApprover, selectedDoctorId, vacationDays]);

  const selectedVacations = useMemo<VacationDay[]>(() => {
    if (!selectedDate || !isApprover) return [] as VacationDay[];
    return vacationsByDate.get(selectedDate) ?? [];
  }, [isApprover, selectedDate, vacationsByDate]);

  const hasPendingByDate = useMemo(() => {
    const next = new Map<string, boolean>();
    vacationsByDate.forEach((entries, date) => {
      const hasPending = entries.some((entry) => !entry.approved);
      next.set(date, hasPending);
    });
    return next;
  }, [vacationsByDate]);

  const availableDoctors = useMemo(() => {
    const next = new Map<string, { id: string; name: string }>();

    vacationDays.forEach((entry) => {
      const doctorId = String(entry.doctorId ?? "unknown");
      const doctorName = entry.doctorName ?? `Arzt #${entry.doctorId ?? "?"}`;
      if (!next.has(doctorId)) {
        next.set(doctorId, { id: doctorId, name: doctorName });
      }
    });

    return Array.from(next.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [vacationDays]);

  const approverStats = useMemo(() => {
    if (!isApprover) {
      return {
        approved: 0,
        unapproved: 0,
        doctors: [] as Array<{
          key: string;
          doctorName: string;
          approved: Record<VacationColor, number>;
          unapproved: Record<VacationColor, number>;
        }>,
      };
    }

    const byDoctor = new Map<
      string,
      {
        key: string;
        doctorName: string;
        approved: Record<VacationColor, number>;
        unapproved: Record<VacationColor, number>;
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
          approved: createColorCountMap(),
          unapproved: createColorCountMap(),
        } as {
          key: string;
          doctorName: string;
          approved: Record<VacationColor, number>;
          unapproved: Record<VacationColor, number>;
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
  }, [isApprover, vacationDays]);

  const modifiers = useMemo(() => {
    const byColor = VACATION_COLORS.reduce(
      (acc, color) => {
        acc[color] = [];
        return acc;
      },
      {} as Record<VacationColor, Date[]>,
    );
    Object.entries(dayColors).forEach(([date, color]) => {
      if (color in byColor) {
        byColor[color].push(parseISO(date));
      }
    });
    return byColor;
  }, [dayColors]);

  const modifierClasses = useMemo(() => {
    return VACATION_COLORS.reduce(
      (acc, color) => {
        acc[color] = cn(VACATION_COLOR_STYLES[color].classes, "rounded-md");
        return acc;
      },
      {} as Record<VacationColor, string>,
    );
  }, []);

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, index) => new Date(year, index, 1)),
    [year],
  );

  if (isLoading) {
    return <div className="text-center">Lädt...</div>;
  }

  if (!doctorId && !isApprover) {
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
            {isApprover
              ? "Klicken Sie auf einen Tag, um Urlaubsfreigaben zu prüfen."
              : `Wählen Sie eine Farbe und klicken Sie dann auf Tage, um Urlaub für ${year} zu markieren.`}
          </p>
        </div>
        {isApprover && (
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
                <SelectItem value="all">Alle Ärzte</SelectItem>
                {availableDoctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {!isApprover && (
          <>
            <div className="flex flex-wrap gap-3">
              {VACATION_COLORS.map((color) => {
                const style = VACATION_COLOR_STYLES[color];
                const used = colorCounts[color];
                const yearlyLimit = VACATION_DAYS_PER_YEAR[color];
                const remaining = Math.max(0, yearlyLimit - used);
                const isActive = activeColor === color;
                return (
                  <Button
                    key={color}
                    type="button"
                    className={cn(
                      style.classes,
                      "min-w-[88px] justify-between",
                      isActive ? `ring-2 ring-offset-2 ${style.ring}` : "",
                    )}
                    disabled={remaining === 0 && !isActive}
                    onClick={() => setActiveColor(color)}
                  >
                    <span>{style.label}</span>
                    <span className="text-xs opacity-90">
                      {remaining}/{yearlyLimit}
                    </span>
                  </Button>
                );
              })}
            </div>
            {!activeColor && (
              <p className="text-xs text-muted-foreground">
                Wählen Sie eine Farbe, um Tage zu markieren.
              </p>
            )}
          </>
        )}
      </div>

      {isApprover && (
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
                      {VACATION_COLORS.map((color) => (
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
                        {VACATION_COLORS.map((color) => (
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {months.map((month) => (
          <div key={month.toISOString()} className="rounded-md border">
            {!isVacationsLoading ? (
              <Calendar
                month={month}
                disableNavigation
                showOutsideDays={false}
                modifiers={modifiers}
                modifiersClassNames={modifierClasses}
                onDayClick={(day) => {
                  if (isApprover) {
                    const key = dayToKey(day);
                    setSelectedDate(key);
                    setIsDialogOpen(true);
                  } else {
                    handleDayClick(day);
                  }
                }}
                components={{
                  DayButton: (
                    props: React.ComponentProps<typeof RdpDayButton>,
                  ) => {
                    const { day, modifiers, className, children, ...rest } =
                      props;
                    const dayKey = dayToKey(day.date);
                    const entries = vacationsByDate.get(dayKey) ?? [];
                    const colors = Array.from(
                      new Set(entries.map((entry: VacationDay) => entry.color)),
                    ) as VacationColor[];
                    const hasPendingApproval =
                      hasPendingByDate.get(dayKey) ?? false;

                    const defaultClassNames = getDefaultClassNames();
                    return (
                      <Button
                        variant="ghost"
                        size="icon"
                        data-day={day.date.toLocaleDateString()}
                        data-selected-single={
                          modifiers.selected &&
                          !modifiers.range_start &&
                          !modifiers.range_end &&
                          !modifiers.range_middle
                        }
                        data-range-start={modifiers.range_start}
                        data-range-end={modifiers.range_end}
                        data-range-middle={modifiers.range_middle}
                        className={cn(
                          "relative data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 dark:hover:text-accent-foreground flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] data-[range-end=true]:rounded-md data-[range-end=true]:rounded-r-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md data-[range-start=true]:rounded-l-md [&>span]:text-xs [&>span]:opacity-70",
                          defaultClassNames.day,
                          className,
                        )}
                        {...rest}
                      >
                        {isApprover && colors.length > 0 && (
                          <span className="absolute inset-0 overflow-hidden rounded-md">
                            {colors.length === 1 && (
                              <span
                                className={cn(
                                  "absolute inset-0 opacity-80",
                                  VACATION_COLOR_STYLES[colors[0]].classes,
                                )}
                              />
                            )}
                            {colors.length === 2 && (
                              <>
                                <span
                                  className={cn(
                                    "absolute inset-x-0 top-0 h-1/2 opacity-80",
                                    VACATION_COLOR_STYLES[colors[0]].classes,
                                  )}
                                />
                                <span
                                  className={cn(
                                    "absolute inset-x-0 bottom-0 h-1/2 opacity-80",
                                    VACATION_COLOR_STYLES[colors[1]].classes,
                                  )}
                                />
                              </>
                            )}
                            {colors.length >= 3 && (
                              <>
                                <span
                                  className={cn(
                                    "absolute inset-x-0 top-0 h-1/3 opacity-80",
                                    VACATION_COLOR_STYLES[colors[0]].classes,
                                  )}
                                />
                                <span
                                  className={cn(
                                    "absolute inset-x-0 top-1/3 h-1/3 opacity-80",
                                    VACATION_COLOR_STYLES[colors[1]].classes,
                                  )}
                                />
                                <span
                                  className={cn(
                                    "absolute inset-x-0 bottom-0 h-1/3 opacity-80",
                                    VACATION_COLOR_STYLES[colors[2]].classes,
                                  )}
                                />
                              </>
                            )}
                          </span>
                        )}
                        {hasPendingApproval && (
                          <span className="absolute top-1 right-1 z-20 h-2.5 w-2.5 rounded-full bg-blue-500 ring-1 ring-background" />
                        )}
                        <span className="relative z-10">{children}</span>
                      </Button>
                    );
                  },
                }}
                className="w-full"
              />
            ) : (
              <CalendarSkeleton />
            )}
          </div>
        ))}
      </div>

      {isVacationsLoading && (
        <p className="text-sm text-muted-foreground">
          Urlaubsdaten werden geladen...
        </p>
      )}
      {updateMutation.isPending && (
        <p className="text-sm text-muted-foreground">
          Änderungen werden gespeichert...
        </p>
      )}
      {approvalMutation.isPending && (
        <p className="text-sm text-muted-foreground">
          Freigabe wird aktualisiert...
        </p>
      )}
      {denyMutation.isPending && (
        <p className="text-sm text-muted-foreground">
          Urlaub wird abgelehnt...
        </p>
      )}
      {isApprover && (
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
                  {selectedVacations.map((vacation: VacationDay) => (
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
                          {vacation.approved ? "Genehmigt" : "Ausstehend"}
                        </span>
                        <Switch
                          checked={!!vacation.approved}
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
