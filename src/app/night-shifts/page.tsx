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
import { Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { CalendarSkeleton } from "@/components/ui/calendar-skeleton";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import {
  DoctorPicker,
  type DoctorPickerOption,
} from "@/components/doctor-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type NightShiftsMonthCalendarProps = {
  month: Date;
  doctorsByDate: Map<string, ShiftDoctor[]>;
  canManage: boolean;
  isMobile: boolean;
  isUpdating: boolean;
  availableDoctors: DoctorPickerOption[];
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
                  <span className="pointer-events-none absolute inset-x-1 top-4 z-10 overflow-hidden whitespace-nowrap text-ellipsis text-[10px] leading-none lg:text-[6px] md:text-[7px] sm:text-[8px]">
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
              onOpenDateChange(null);
            }}
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
                    onOpenDateChange(null);
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

export default function NightShiftsPage() {
  const { user, isLoading } = useAuth();
  const { doctorsApi, nightShiftsApi } = useApiClient();
  const queryClient = useQueryClient();
  const year = new Date().getFullYear();
  const canManage =
    user?.role === "secretary" || user?.role === "shift_assigner";
  const doctorId = user?.doctorId ?? null;
  const canViewNightShifts = canManage || user?.role === "doctor";
  const nightShiftsQueryKey = useMemo(
    () => ["night-shifts", year, ALL_DOCTORS_VALUE],
    [year],
  );

  const { data: doctors = [], isLoading: isDoctorsLoading } = useQuery({
    queryKey: ["doctors"],
    queryFn: doctorsApi.getAll,
    enabled: canViewNightShifts,
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
  const hasInitializedDoctorSelection = useRef(false);
  const nightShifts = optimisticNightShifts ?? data ?? EMPTY_NIGHT_SHIFTS;

  useEffect(() => {
    setOptimisticNightShifts(null);
  }, [data]);

  useEffect(() => {
    setPickerSearchTerm("");
  }, [openDate]);

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

  const availableDoctors = useMemo<DoctorPickerOption[]>(() => {
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
    if (!canViewNightShifts) {
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
  }, [
    availableDoctors,
    canViewNightShifts,
    isDoctorsLoading,
    selectedDoctorId,
  ]);

  const visibleDoctorId =
    selectedDoctorId === ALL_DOCTORS_VALUE ? null : selectedDoctorId;

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
        ? shift.doctors.filter(
            (doctor) => String(doctor.id) === visibleDoctorId,
          )
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
        shift.doctorIds
          .map((entry) => String(entry))
          .sort((left, right) => left.localeCompare(right)),
      );
    });

    return next;
  }, [nightShifts]);

  const mobileInfoDoctors = mobileInfoDate
    ? (visibleDoctorsByDate.get(mobileInfoDate) ?? [])
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
      ? []
      : [parsedDoctorId];

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

        {canViewNightShifts ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={selectedDoctorId}
              onValueChange={setSelectedDoctorId}
            >
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

      {(isNightShiftsLoading || isDoctorsLoading) && (
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
