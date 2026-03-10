"use client";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { flushSync } from "react-dom";
import { Check, Loader2, Search, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { CalendarSkeleton } from "@/components/ui/calendar-skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
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
import { useAuth } from "@/lib/auth-client";
import type { NightShift, ShiftDoctor } from "@/lib/api";
import { useApiClient } from "@/lib/use-api-client";
import { cn } from "@/lib/utils";

const EMPTY_NIGHT_SHIFTS: NightShift[] = [];
const DEFAULT_DOCTOR_COLOR = "#64748b";
const ALL_DOCTORS_VALUE = "all";

const dayToKey = (day: Date) => format(day, "yyyy-MM-dd");

type DoctorOption = {
  id: string;
  name: string;
  color: string;
};

type NightShiftPickerProps = {
  open: boolean;
  doctors: DoctorOption[];
  searchTerm: string;
  selectedDoctorIds: readonly string[];
  onSearchTermChange: (value: string) => void;
  onToggleDoctor: (doctorId: string) => void;
};

function NightShiftPicker({
  open,
  doctors,
  searchTerm,
  selectedDoctorIds,
  onSearchTermChange,
  onToggleDoctor,
}: NightShiftPickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const selectedIdSet = useMemo(
    () => new Set(selectedDoctorIds),
    [selectedDoctorIds],
  );

  const filteredDoctors = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    return doctors.filter((doctor) =>
      normalizedTerm.length === 0
        ? true
        : doctor.name.toLowerCase().includes(normalizedTerm),
    );
  }, [doctors, searchTerm]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Arzt suchen"
            className="pl-9"
          />
        </div>
        {selectedDoctorIds.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {selectedDoctorIds.map((doctorId) => {
              const doctor = doctors.find((entry) => entry.id === doctorId);

              if (!doctor) {
                return null;
              }

              return (
                <button
                  key={doctor.id}
                  type="button"
                  onClick={() => onToggleDoctor(doctor.id)}
                  className="cursor-pointer rounded-full"
                >
                  <Pill
                    color={doctor.color}
                    className="inline-flex cursor-pointer items-center gap-1 text-xs"
                  >
                    <span>{doctor.name}</span>
                    <Trash2 className="size-3" />
                  </Pill>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Noch kein Arzt ausgewahlt.
          </p>
        )}
      </div>

      <div className="max-h-64 space-y-1 overflow-auto">
        {filteredDoctors.length === 0 ? (
          <div className="rounded-md px-3 py-2 text-sm text-muted-foreground">
            Keine passenden Arzte gefunden.
          </div>
        ) : (
          filteredDoctors.map((doctor) => {
            const isSelected = selectedIdSet.has(doctor.id);

            return (
              <button
                key={doctor.id}
                type="button"
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent",
                  isSelected && "bg-accent/70",
                )}
                onClick={() => onToggleDoctor(doctor.id)}
              >
                <Pill color={doctor.color} className="text-xs">
                  {doctor.name}
                </Pill>
                <span className="flex h-4 w-4 items-center justify-center rounded-sm border">
                  {isSelected ? <Check className="size-3" /> : null}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

type NightShiftsMonthCalendarProps = {
  month: Date;
  doctorsByDate: Map<string, ShiftDoctor[]>;
  canManage: boolean;
  isMobile: boolean;
  isUpdating: boolean;
  availableDoctors: DoctorOption[];
  openDate: string | null;
  pickerSearchTerm: string;
  selectedDoctorIdsByDate: Map<string, string[]>;
  onOpenDateChange: (date: string | null) => void;
  onPickerSearchTermChange: (value: string) => void;
  onToggleDoctor: (date: string, doctorId: string) => void;
};

const NightShiftsMonthCalendar = memo(function NightShiftsMonthCalendar({
  month,
  doctorsByDate,
  canManage,
  isMobile,
  isUpdating,
  availableDoctors,
  openDate,
  pickerSearchTerm,
  selectedDoctorIdsByDate,
  onOpenDateChange,
  onPickerSearchTermChange,
  onToggleDoctor,
}: NightShiftsMonthCalendarProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const [pickerPosition, setPickerPosition] = useState<{
    top: number;
    left: number;
    minWidth: number;
  } | null>(null);

  useEffect(() => {
    if (!canManage || !openDate) {
      setPickerPosition(null);
      return;
    }

    const wrapper = wrapperRef.current;
    const anchor = cellRefs.current.get(openDate);

    if (!wrapper || !anchor) {
      setPickerPosition(null);
      return;
    }

    const wrapperRect = wrapper.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();

    setPickerPosition({
      top: anchorRect.bottom - wrapperRect.top + 6,
      left: anchorRect.left - wrapperRect.left,
      minWidth: Math.max(anchorRect.width, 280),
    });
  }, [canManage, openDate, pickerSearchTerm, selectedDoctorIdsByDate]);

  useEffect(() => {
    if (!canManage || !openDate || isMobile) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) {
        return;
      }

      onOpenDateChange(null);
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [canManage, isMobile, onOpenDateChange, openDate]);

  return (
    <div ref={wrapperRef} className="relative rounded-md border">
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
            const tooltip = doctorsForDay.map((doctor) => doctor.name).join("\n");
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
          <NightShiftPicker
            open={openDate != null}
            doctors={availableDoctors}
            searchTerm={pickerSearchTerm}
            selectedDoctorIds={selectedDoctorIdsByDate.get(openDate) ?? []}
            onSearchTermChange={onPickerSearchTermChange}
            onToggleDoctor={(doctorId) => onToggleDoctor(openDate, doctorId)}
          />
        </div>
      ) : null}

      {canManage && isMobile ? (
        <Dialog open={openDate != null} onOpenChange={(open) => !open && onOpenDateChange(null)}>
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
                <NightShiftPicker
                  open={openDate != null}
                  doctors={availableDoctors}
                  searchTerm={pickerSearchTerm}
                  selectedDoctorIds={selectedDoctorIdsByDate.get(openDate) ?? []}
                  onSearchTermChange={onPickerSearchTermChange}
                  onToggleDoctor={(doctorId) => onToggleDoctor(openDate, doctorId)}
                />
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
});

export default function NightShiftsPage() {
  const { user, isLoading } = useAuth();
  const { doctorsApi, nightShiftsApi } = useApiClient();
  const queryClient = useQueryClient();
  const year = new Date().getFullYear();
  const canManage =
    user?.role === "secretary" || user?.role === "shift_assigner";
  const doctorId = user?.doctorId ?? null;
  const canViewOwnNightShifts = user?.role === "doctor" && doctorId != null;
  const canViewNightShifts = canManage || canViewOwnNightShifts;
  const nightShiftsQueryKey = useMemo(
    () => ["night-shifts", year, canManage ? ALL_DOCTORS_VALUE : doctorId],
    [canManage, doctorId, year],
  );

  const { data: doctors = [], isLoading: isDoctorsLoading } = useQuery({
    queryKey: ["doctors"],
    queryFn: doctorsApi.getAll,
    enabled: canManage,
  });

  const {
    data,
    isLoading: isNightShiftsLoading,
    isFetching: isNightShiftsFetching,
  } = useQuery({
    queryKey: nightShiftsQueryKey,
    queryFn: () => nightShiftsApi.getByYear(year),
    enabled: canViewNightShifts,
  });

  const [optimisticNightShifts, setOptimisticNightShifts] = useState<
    NightShift[] | null
  >(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState(ALL_DOCTORS_VALUE);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [pickerSearchTerm, setPickerSearchTerm] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [mobileInfoDate, setMobileInfoDate] = useState<string | null>(null);
  const nightShifts = optimisticNightShifts ?? data ?? EMPTY_NIGHT_SHIFTS;

  useEffect(() => {
    setOptimisticNightShifts(null);
  }, [data]);

  useEffect(() => {
    setPickerSearchTerm("");
  }, [openDate]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    const updateIsMobile = (matches: boolean) => {
      setIsMobile(matches);
    };

    updateIsMobile(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      updateIsMobile(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const availableDoctors = useMemo<DoctorOption[]>(() => {
    return doctors
      .filter((doctor) => !doctor.disabled && !doctor.oa)
      .map((doctor) => ({
        id: String(doctor.id),
        name: doctor.name,
        color:
          typeof doctor.color === "string" && doctor.color.trim() !== ""
            ? doctor.color
            : DEFAULT_DOCTOR_COLOR,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [doctors]);

  useEffect(() => {
    if (!canManage) {
      return;
    }

    if (selectedDoctorId === ALL_DOCTORS_VALUE) {
      return;
    }

    const exists = availableDoctors.some((doctor) => doctor.id === selectedDoctorId);
    if (!exists) {
      setSelectedDoctorId(ALL_DOCTORS_VALUE);
    }
  }, [availableDoctors, canManage, selectedDoctorId]);

  const visibleDoctorId = canManage
    ? selectedDoctorId === ALL_DOCTORS_VALUE
      ? null
      : selectedDoctorId
    : doctorId != null
      ? String(doctorId)
      : null;

  const updateMutation = useMutation({
    mutationFn: ({ date, doctorIds }: { date: string; doctorIds: number[] }) =>
      nightShiftsApi.update(date, doctorIds),
    onSuccess: () => {
      console.log("synced");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: nightShiftsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });

  const nightShiftByDate = useMemo(() => {
    return new Map(nightShifts.map((shift) => [shift.date, shift]));
  }, [nightShifts]);

  const visibleDoctorsByDate = useMemo(() => {
    const next = new Map<string, ShiftDoctor[]>();

    nightShifts.forEach((shift) => {
      const doctorsForDay = visibleDoctorId
        ? shift.doctors.filter((doctor) => String(doctor.id) === visibleDoctorId)
        : shift.doctors;

      if (doctorsForDay.length > 0) {
        next.set(shift.date, doctorsForDay);
      }
    });

    return next;
  }, [nightShifts, visibleDoctorId]);

  const selectedDoctorIdsByDate = useMemo(() => {
    const next = new Map<string, string[]>();

    nightShifts.forEach((shift) => {
      next.set(
        shift.date,
        shift.doctorIds.map((entry) => String(entry)).sort((left, right) =>
          left.localeCompare(right),
        ),
      );
    });

    return next;
  }, [nightShifts]);

  const mobileInfoDoctors = mobileInfoDate
    ? visibleDoctorsByDate.get(mobileInfoDate) ?? []
    : [];

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, index) => new Date(year, index, 1)),
    [year],
  );

  const visibleDoctorsByMonth = useMemo(() => {
    return months.map((month) => {
      const prefix = format(month, "yyyy-MM");
      const byDate = new Map<string, ShiftDoctor[]>();

      visibleDoctorsByDate.forEach((doctorsForDay, date) => {
        if (date.startsWith(prefix)) {
          byDate.set(date, doctorsForDay);
        }
      });

      return byDate;
    });
  }, [months, visibleDoctorsByDate]);

  const handleToggleDoctor = (date: string, doctorIdToToggle: string) => {
    if (!canManage) {
      return;
    }

    const parsedDoctorId = Number(doctorIdToToggle);
    if (!Number.isInteger(parsedDoctorId)) {
      return;
    }

    const existingShift = nightShiftByDate.get(date);
    const currentDoctorIds = existingShift?.doctorIds ?? [];
    const nextDoctorIds = currentDoctorIds.includes(parsedDoctorId)
      ? currentDoctorIds.filter((doctorId) => doctorId !== parsedDoctorId)
      : [...currentDoctorIds, parsedDoctorId].sort((left, right) => left - right);

    const nextNightShifts = (() => {
      const optimisticShift: NightShift = {
        id: existingShift?.id ?? -Math.abs(new Date(date).getTime()),
        date,
        shiftType: "night",
        doctorIds: nextDoctorIds,
        doctors: nextDoctorIds.map((doctorId) => {
          const doctor = doctors.find((entry) => entry.id === doctorId);
          return {
            id: doctorId,
            name: doctor?.name ?? `Doctor #${doctorId}`,
            color: doctor?.color ?? DEFAULT_DOCTOR_COLOR,
          };
        }),
      };

      const filtered = nightShifts.filter((shift) => shift.date !== date);
      if (nextDoctorIds.length === 0) {
        return filtered;
      }

      return [...filtered, optimisticShift].sort((left, right) =>
        left.date.localeCompare(right.date),
      );
    })();

    flushSync(() => {
      setOptimisticNightShifts(nextNightShifts);
    });

    requestAnimationFrame(() => {
      updateMutation.mutate({ date, doctorIds: nextDoctorIds });
    });
  };

  if (isLoading) {
    return <div className="text-center">Lädt...</div>;
  }

  if (!canViewNightShifts) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Nachtdienste</h2>
        <p className="text-sm text-muted-foreground">
          Sie mussen einem Arzt zugewiesen sein, um Nachtdienste zu sehen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-2xl font-semibold">Nachtdienste</h2>
          <p className="text-sm text-muted-foreground">
            {canManage
              ? "Klicken Sie auf einen Tag, um Aerzte per Suche hinzuzufugen oder zu entfernen."
              : `Hier sehen Sie Ihre Nachtdienste fur ${year}.`}
          </p>
        </div>

        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Arzt auswahlen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DOCTORS_VALUE}>Alle Arzte</SelectItem>
                {availableDoctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {months.map((month, index) =>
          !isNightShiftsLoading ? (
            <NightShiftsMonthCalendar
              key={month.toISOString()}
              month={month}
              doctorsByDate={visibleDoctorsByMonth[index] ?? new Map()}
              canManage={canManage}
              isMobile={isMobile}
              isUpdating={updateMutation.isPending || isNightShiftsFetching}
              availableDoctors={availableDoctors}
              openDate={openDate}
              pickerSearchTerm={pickerSearchTerm}
              selectedDoctorIdsByDate={selectedDoctorIdsByDate}
              onOpenDateChange={(date) => {
                if (!canManage && isMobile) {
                  setMobileInfoDate(date);
                  return;
                }

                setOpenDate(date);
              }}
              onPickerSearchTermChange={setPickerSearchTerm}
              onToggleDoctor={handleToggleDoctor}
            />
          ) : (
            <div key={month.toISOString()} className="rounded-md border">
              <CalendarSkeleton />
            </div>
          ),
        )}
      </div>

      {(isNightShiftsLoading || (canManage && isDoctorsLoading)) && (
        <p className="text-sm text-muted-foreground">
          Nachtdienstdaten werden geladen...
        </p>
      )}
      {canManage && updateMutation.isPending && (
        <p className="text-sm text-muted-foreground">
          Nachtdienste werden gespeichert...
        </p>
      )}
      {canManage && availableDoctors.length === 0 && !isDoctorsLoading && (
        <p className="text-sm text-muted-foreground">
          Keine aktiven Arzte fur Nachtdienste verfugbar.
        </p>
      )}
      {!canManage ? (
        <Dialog
          open={mobileInfoDate != null}
          onOpenChange={(open) => {
            if (!open) {
              setMobileInfoDate(null);
            }
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Nachtdienst</DialogTitle>
              <DialogDescription>
                {mobileInfoDate
                  ? `Aerzte am ${format(new Date(`${mobileInfoDate}T00:00:00`), "dd.MM.yyyy")}`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            {mobileInfoDoctors.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {mobileInfoDoctors.map((doctor) => (
                  <Pill
                    key={doctor.id}
                    color={doctor.color ?? DEFAULT_DOCTOR_COLOR}
                    className="text-xs"
                  >
                    {doctor.name}
                  </Pill>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Kein Nachtdienst an diesem Tag.
              </p>
            )}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
