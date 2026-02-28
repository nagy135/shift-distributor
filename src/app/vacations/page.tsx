"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-client";
import { vacationsApi, type VacationDay } from "@/lib/api";
import { VACATION_COLORS, type VacationColor } from "@/lib/vacations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { getDefaultClassNames, DayButton as RdpDayButton } from "react-day-picker";

const QUOTA_TOTAL = 5;

const COLOR_STYLES: Record<
  VacationColor,
  { label: string; classes: string; ring: string }
> = {
  red: {
    label: "Red",
    classes: "bg-red-500 text-white hover:bg-red-600",
    ring: "ring-red-500",
  },
  orange: {
    label: "Orange",
    classes: "bg-orange-500 text-white hover:bg-orange-600",
    ring: "ring-orange-500",
  },
  green: {
    label: "Green",
    classes: "bg-emerald-500 text-white hover:bg-emerald-600",
    ring: "ring-emerald-500",
  },
};

const countColors = (input: Record<string, VacationColor>) => {
  return Object.values(input).reduce(
    (acc, color) => {
      acc[color] += 1;
      return acc;
    },
    { red: 0, orange: 0, green: 0 } as Record<VacationColor, number>,
  );
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
  const { user, accessToken, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const doctorId = user?.doctorId ?? null;
  const isApprover = user?.role === "secretary";
  const year = new Date().getFullYear();

  const { data: vacationDays = [], isLoading: isVacationsLoading } = useQuery({
    queryKey: ["vacations", isApprover ? "all" : doctorId, year],
    queryFn: () => vacationsApi.getByYear(year, accessToken),
    enabled: !!accessToken && (isApprover || !!doctorId),
  });

  const [dayColors, setDayColors] = useState<Record<string, VacationColor>>({});
  const [activeColor, setActiveColor] = useState<VacationColor | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
    mutationFn: (days: VacationDay[]) =>
      vacationsApi.updateYear(year, days, accessToken),
  });

  const approvalMutation = useMutation({
    mutationFn: ({ id, approved }: { id: number; approved: boolean }) =>
      vacationsApi.updateApproval(id, approved, accessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["vacations", isApprover ? "all" : doctorId, year],
      });
    },
  });

  const denyMutation = useMutation({
    mutationFn: (id: number) => vacationsApi.deny(id, accessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["vacations", isApprover ? "all" : doctorId, year],
      });
    },
  });


  const persistDays = useCallback(
    (nextMap: Record<string, VacationColor>) => {
      if (!accessToken) return;
      const payload: VacationDay[] = Object.entries(nextMap).map(
        ([date, color]) => ({ date, color }),
      );
      updateMutation.mutate(payload);
    },
    [accessToken, updateMutation],
  );

  const handleDayClick = useCallback(
    (day: Date) => {
      if (!activeColor) return;
      const key = dayToKey(day);

      setDayColors((current) => {
        const existing = current[key];
        const counts = countColors(current);
        const remaining =
          QUOTA_TOTAL - counts[activeColor] + (existing ? 1 : 0);
        if (!existing && remaining <= 0) {
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

  const vacationsByDate = useMemo(
    () => (isApprover ? getDayColors(vacationDays) : new Map()),
    [isApprover, vacationDays],
  );

  const selectedVacations = useMemo<VacationDay[]>(() => {
    if (!selectedDate || !isApprover) return [] as VacationDay[];
    return vacationsByDate.get(selectedDate) ?? [];
  }, [isApprover, selectedDate, vacationsByDate]);

  const modifiers = useMemo(() => {
    const byColor: Record<VacationColor, Date[]> = {
      red: [],
      orange: [],
      green: [],
    };
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
        acc[color] = COLOR_STYLES[color].classes;
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
    return <div className="text-center">Loading...</div>;
  }

  if (!doctorId && !isApprover) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Vacations</h2>
        <p className="text-sm text-muted-foreground">
          You need to be assigned to a doctor to manage vacation days.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-2xl font-semibold">Vacations</h2>
          <p className="text-sm text-muted-foreground">
            {isApprover
              ? "Click a day to review vacation approvals."
              : `Select a color, then click days to mark vacations for ${year}.`}
          </p>
        </div>
        {!isApprover && (
          <>
            <div className="flex flex-wrap gap-3">
              {VACATION_COLORS.map((color) => {
                const style = COLOR_STYLES[color];
                const used = colorCounts[color];
                const remaining = Math.max(0, QUOTA_TOTAL - used);
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
                    <span className="text-xs opacity-90">{remaining}/5</span>
                  </Button>
                );
              })}
            </div>
            {!activeColor && (
              <p className="text-xs text-muted-foreground">
                Choose a color to start marking days.
              </p>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {months.map((month) => (
          <div key={month.toISOString()} className="rounded-md border">
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
              components={
                isApprover
                  ? {
                      DayButton: (
                        props: React.ComponentProps<typeof RdpDayButton>,
                      ) => {
                        const { day, modifiers, className, children, ...rest } =
                          props;
                        const dayKey = dayToKey(day.date);
                        const entries = vacationsByDate.get(dayKey) ?? [];
                        const colors = Array.from(
                          new Set(
                            entries.map((entry: VacationDay) => entry.color),
                          ),
                        ) as VacationColor[];

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
                            {colors.length > 0 && (
                              <span className="absolute inset-0 overflow-hidden rounded-md">
                                {colors.length === 1 && (
                                  <span
                                    className={cn(
                                      "absolute inset-0 opacity-80",
                                      COLOR_STYLES[colors[0]].classes,
                                    )}
                                  />
                                )}
                                {colors.length === 2 && (
                                  <>
                                    <span
                                      className={cn(
                                        "absolute inset-x-0 top-0 h-1/2 opacity-80",
                                        COLOR_STYLES[colors[0]].classes,
                                      )}
                                    />
                                    <span
                                      className={cn(
                                        "absolute inset-x-0 bottom-0 h-1/2 opacity-80",
                                        COLOR_STYLES[colors[1]].classes,
                                      )}
                                    />
                                  </>
                                )}
                                {colors.length >= 3 && (
                                  <>
                                    <span
                                      className={cn(
                                        "absolute inset-x-0 top-0 h-1/3 opacity-80",
                                        COLOR_STYLES[colors[0]].classes,
                                      )}
                                    />
                                    <span
                                      className={cn(
                                        "absolute inset-x-0 top-1/3 h-1/3 opacity-80",
                                        COLOR_STYLES[colors[1]].classes,
                                      )}
                                    />
                                    <span
                                      className={cn(
                                        "absolute inset-x-0 bottom-0 h-1/3 opacity-80",
                                        COLOR_STYLES[colors[2]].classes,
                                      )}
                                    />
                                  </>
                                )}
                              </span>
                            )}
                            <span className="relative z-10">{children}</span>
                          </Button>
                        );
                      },
                    }
                  : undefined
              }
              className="w-full"
            />
          </div>
        ))}
      </div>

      {isVacationsLoading && (
        <p className="text-sm text-muted-foreground">Loading vacations...</p>
      )}
      {updateMutation.isPending && (
        <p className="text-sm text-muted-foreground">Saving changes...</p>
      )}
      {approvalMutation.isPending && (
        <p className="text-sm text-muted-foreground">Updating approval...</p>
      )}
      {denyMutation.isPending && (
        <p className="text-sm text-muted-foreground">Denying vacation...</p>
      )}
      {isApprover && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Vacation approvals</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {selectedDate}
              </div>
              {selectedVacations.length === 0 ? (
                <div className="text-sm">No vacations for this day.</div>
              ) : (
                <div className="space-y-3">
                  {selectedVacations.map((vacation: VacationDay) => (
                    <div
                      key={vacation.id ?? `${vacation.doctorId}-${vacation.date}`}
                      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "h-3 w-3 rounded-full",
                            COLOR_STYLES[vacation.color].classes,
                          )}
                        />
                        <div className="text-sm">
                          {vacation.doctorName ?? `Doctor #${vacation.doctorId}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {vacation.approved ? "Approved" : "Pending"}
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
                          Deny
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
