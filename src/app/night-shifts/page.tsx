"use client";

import {
  DoctorPicker,
  type DoctorPickerOption,
} from "@/components/doctor-picker";
import { MonthlySingleColumnTable } from "@/components/shifts/MonthlySingleColumnTable";
import { CalendarSkeleton } from "@/components/ui/calendar-skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pill } from "@/components/ui/pill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NightShift, ShiftDoctor } from "@/lib/api";
import { useAuth } from "@/lib/auth-client";
import { invalidateSchedule, queryKeys } from "@/lib/query-keys";
import { isAssigner } from "@/lib/roles";
import { useAnchoredOverlay } from "@/lib/use-anchored-overlay";
import { useApiClient } from "@/lib/use-api-client";
import { useMediaQuery } from "@/lib/use-media-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  ALL_DOCTORS_VALUE,
  dayToKey,
  DEFAULT_DOCTOR_COLOR,
  EMPTY_NIGHT_SHIFTS,
  NIGHT_SHIFT_TABLE_COLUMN,
  NightShiftsMonthCalendar,
  sortDoctorsAlphabetically,
} from "@/components/night-shifts/NightShiftCalendar";

export default function NightShiftsPage() {
  const { user, isLoading, getSessionGeneration } = useAuth();
  const { doctorsApi, nightShiftsApi } = useApiClient();
  const queryClient = useQueryClient();
  const year = new Date().getFullYear();
  const canManage = user?.role === "secretary" || isAssigner(user?.role);
  const doctorId = user?.doctorId ?? null;
  const canViewNightShifts = canManage || user?.role === "doctor";
  const nightShiftsQueryKey = useMemo(
    () => queryKeys.nightShifts(year),
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

  const saveInFlight = useRef(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState(ALL_DOCTORS_VALUE);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [pickerSearchTerm, setPickerSearchTerm] = useState("");
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [mobileInfoDate, setMobileInfoDate] = useState<string | null>(null);
  const [tableMonth, setTableMonth] = useState<Date | null>(null);
  const [tableOpenDate, setTableOpenDate] = useState<string | null>(null);
  const hasInitializedDoctorSelection = useRef(false);
  const tableWrapperRef = useRef<HTMLDivElement | null>(null);
  const tableCellRefs = useRef(new Map<string, HTMLTableCellElement>());
  const tablePickerPosition = useAnchoredOverlay({
    anchorKey: tableOpenDate,
    anchorRefs: tableCellRefs,
    wrapperRef: tableWrapperRef,
    isEnabled: tableMonth != null && canManage,
    isMobile,
    alignWithinViewport: true,
    recalculateKey: `${tableMonth?.getTime() ?? ""}:${pickerSearchTerm}`,
    onRequestClose: () => setTableOpenDate(null),
  });
  const nightShifts = data ?? EMPTY_NIGHT_SHIFTS;

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
    mutationFn: ({
      date,
      doctorIds,
      expectedVersion,
    }: {
      date: string;
      doctorIds: number[];
      expectedVersion: number;
    }) => nightShiftsApi.update(date, doctorIds, expectedVersion),
    onMutate: async ({ date, doctorIds }) => {
      const generation = getSessionGeneration();
      await queryClient.cancelQueries({ queryKey: nightShiftsQueryKey });
      if (generation !== getSessionGeneration()) return;
      const previous =
        queryClient.getQueryData<NightShift[]>(nightShiftsQueryKey) ?? [];
      const existing = previous.find((shift) => shift.date === date);
      const next: NightShift = {
        id: existing?.id ?? 0,
        date,
        shiftType: "night",
        version: existing?.version ?? 0,
        doctorIds,
        doctors: doctors
          .filter((doctor) => doctorIds.includes(doctor.id))
          .map((doctor) => ({
            id: doctor.id,
            name: doctor.name,
            color: doctor.color,
          })),
      };
      queryClient.setQueryData(nightShiftsQueryKey, [
        ...previous.filter((shift) => shift.date !== date),
        next,
      ]);
      return { previous, generation };
    },
    onError: (error, _, context) => {
      if (context && context.generation === getSessionGeneration())
        queryClient.setQueryData(nightShiftsQueryKey, context.previous);
      toast.error(error.message);
    },
    onSettled: async () => {
      await invalidateSchedule(queryClient);
      saveInFlight.current = false;
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
        next.set(shift.date, sortDoctorsAlphabetically(doctorsForDay));
      }
    });

    return next;
  }, [nightShifts, visibleDoctorId]);

  const selectedDoctorIdsByDate = useMemo(() => {
    const next = new Map<string, string[]>();

    nightShifts.forEach((shift) => {
      const doctorsForDay = sortDoctorsAlphabetically(shift.doctors);

      next.set(
        shift.date,
        doctorsForDay.map((doctor) => String(doctor.id)),
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

  const tableValuesByMonth = useMemo(() => {
    return visibleDoctorsByMonth.map((byDate) => {
      const next = new Map<string, { text: string; title?: string }>();

      byDate.forEach((doctorsForDay, date) => {
        const names = doctorsForDay.map((doctor) => doctor.name);

        next.set(date, {
          text: names.join("/"),
          title: names.join("\n") || undefined,
        });
      });

      return next;
    });
  }, [visibleDoctorsByMonth]);

  const activeTableMonthIndex = tableMonth ? tableMonth.getMonth() : -1;
  const activeTableValues =
    activeTableMonthIndex >= 0
      ? (tableValuesByMonth[activeTableMonthIndex] ?? new Map())
      : new Map<string, { text: string; title?: string }>();

  const handleToggleDoctor = (date: string, doctorIdToToggle: string) => {
    if (!canManage || saveInFlight.current) return;

    const parsedDoctorId = Number(doctorIdToToggle);
    if (!Number.isInteger(parsedDoctorId)) {
      return;
    }

    const existingShift = nightShiftByDate.get(date);
    const currentDoctorIds = existingShift?.doctorIds ?? [];
    const nextDoctorIds = currentDoctorIds.includes(parsedDoctorId)
      ? currentDoctorIds.filter((doctorId) => doctorId !== parsedDoctorId)
      : [...currentDoctorIds, parsedDoctorId].sort(
          (left, right) => left - right,
        );

    saveInFlight.current = true;
    updateMutation.mutate({
      date,
      doctorIds: nextDoctorIds,
      expectedVersion: existingShift?.version ?? 0,
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
              canOpenMonthTable={canViewNightShifts}
              isMobile={isMobile}
              isUpdating={updateMutation.isPending || isNightShiftsFetching}
              availableDoctors={availableDoctors}
              openDate={
                openDate?.startsWith(format(month, "yyyy-MM")) ? openDate : null
              }
              pickerSearchTerm={pickerSearchTerm}
              selectedDoctorIdsByDate={selectedDoctorIdsByDate}
              onOpenMonthTable={(selectedMonth) => {
                setOpenDate(null);
                setTableOpenDate(null);
                setTableMonth(selectedMonth);
              }}
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
            <DialogTitle>Monatstabelle Nachtdienst</DialogTitle>
            <DialogDescription>
              {tableMonth
                ? format(tableMonth, "MMMM yyyy", { locale: de })
                : ""}
            </DialogDescription>
          </DialogHeader>
          {tableMonth ? (
            <MonthlySingleColumnTable
              month={tableMonth}
              column={NIGHT_SHIFT_TABLE_COLUMN}
              valuesByDate={activeTableValues}
              selectedDateKey={tableOpenDate}
              wrapperRef={tableWrapperRef}
              cellRefs={tableCellRefs}
              containerClassName="max-h-[70vh]"
              onCellClick={
                canManage
                  ? (day) => {
                      setTableOpenDate(dayToKey(day));
                    }
                  : undefined
              }
            >
              {canManage &&
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
                  {updateMutation.isPending || isNightShiftsFetching ? (
                    <Loader2 className="absolute right-3 top-3 size-4 animate-spin text-muted-foreground" />
                  ) : null}
                  <div className="mb-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Nachtdienst
                    </div>
                    <div className="mt-1 text-sm font-medium">
                      {format(
                        new Date(`${tableOpenDate}T00:00:00`),
                        "dd.MM.yyyy",
                      )}
                    </div>
                  </div>
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
                    }}
                    onClose={() => setTableOpenDate(null)}
                  />
                </div>
              ) : null}
            </MonthlySingleColumnTable>
          ) : null}
        </DialogContent>
      </Dialog>

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
      {canManage && isMobile ? (
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
              <DialogTitle>Nachtdienst</DialogTitle>
              <DialogDescription>
                {tableOpenDate
                  ? `Aerzte fur ${format(new Date(`${tableOpenDate}T00:00:00`), "dd.MM.yyyy")} suchen, auswahlen oder entfernen.`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            {tableOpenDate ? (
              <div className="relative">
                {updateMutation.isPending || isNightShiftsFetching ? (
                  <Loader2 className="absolute right-0 top-0 size-4 animate-spin text-muted-foreground" />
                ) : null}
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
                  }}
                />
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
