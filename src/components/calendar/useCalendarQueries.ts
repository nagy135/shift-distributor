"use client";

import { type MonthPublication, type UnavailableDate } from "@/lib/api";
import { schedulingRange } from "@/lib/dates";
import {
  getAutomaticNightShiftVacationDays,
  getDoctorNamesByDate,
} from "@/lib/night-shift-vacations";
import { invalidateSchedule, queryKeys } from "@/lib/query-keys";
import { indexAbsences } from "@/lib/scheduling-rules";
import { useApiClient } from "@/lib/use-api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useCallback, useMemo } from "react";

const EMPTY_DOCTORS: import("@/lib/contracts").Doctor[] = [];
const EMPTY_SHIFTS: import("@/lib/contracts").Shift[] = [];
const EMPTY_VACATIONS: import("@/lib/contracts").VacationDay[] = [];

export function useCalendarQueries(month: Date) {
  const queryClient = useQueryClient();
  const {
    doctorsApi,
    shiftsApi,
    unavailableDatesApi,
    vacationsApi,
    monthPublicationsApi,
  } = useApiClient();
  const normalizedMonth = month instanceof Date ? month : new Date(month);
  const year = Number.isNaN(normalizedMonth.getTime())
    ? new Date().getFullYear()
    : normalizedMonth.getFullYear();
  const monthKey = Number.isNaN(normalizedMonth.getTime())
    ? format(new Date(), "yyyy-MM")
    : format(normalizedMonth, "yyyy-MM");

  const doctorsQuery = useQuery({
    queryKey: ["doctors"],
    queryFn: doctorsApi.getAll,
  });

  const doctors = doctorsQuery.data ?? EMPTY_DOCTORS;
  const range = schedulingRange(normalizedMonth);
  const shiftsQuery = useQuery({
    queryKey: queryKeys.shifts(range),
    queryFn: () => shiftsApi.getAll(range),
  });
  const allShifts = shiftsQuery.data ?? EMPTY_SHIFTS;

  const unavailableQuery = useQuery({
    queryKey: [
      "unavailable-by-doctor",
      doctors?.map((doctor) => doctor.id).join("|"),
    ],
    queryFn: async () => {
      const records: UnavailableDate[] = await unavailableDatesApi.getAll(
        doctors.map((doctor) => doctor.id),
      );
      const grouped = Object.fromEntries(
        doctors.map((doctor) => [doctor.id, new Set<string>()]),
      ) as Record<number, Set<string>>;

      records.forEach((record) => {
        if (!grouped[record.doctorId]) {
          grouped[record.doctorId] = new Set<string>();
        }

        grouped[record.doctorId].add(record.date);
      });

      return grouped;
    },
    enabled: (doctors ?? []).length > 0,
  });

  const unavailableByDoctor = unavailableQuery.data ?? {};
  const vacationsQuery = useQuery({
    queryKey: queryKeys.vacations(year),
    queryFn: () => vacationsApi.getByYear(year),
  });
  const vacationDays = vacationsQuery.data ?? EMPTY_VACATIONS;
  const vacationDoctorIdsByDate = useMemo(
    () =>
      indexAbsences([
        ...vacationDays,
        ...getAutomaticNightShiftVacationDays(allShifts, doctors),
      ]),
    [vacationDays, allShifts, doctors],
  );

  const publicationQuery = useQuery({
    queryKey: ["month-publication", monthKey],
    queryFn: () => monthPublicationsApi.getByMonth(monthKey),
  });
  const monthPublication =
    publicationQuery.data ??
    ({
      month: monthKey,
      isPublished: true,
      publishedAt: null,
      publishedByUserId: null,
      updatedAt: null,
    } satisfies MonthPublication);
  const monthPublicationLoading = publicationQuery.isPending;
  const shiftsLoading =
    doctorsQuery.isPending ||
    shiftsQuery.isPending ||
    vacationsQuery.isPending ||
    publicationQuery.isPending ||
    (doctors.length > 0 && unavailableQuery.isPending);
  const dataError =
    doctorsQuery.error ??
    shiftsQuery.error ??
    vacationsQuery.error ??
    unavailableQuery.error ??
    publicationQuery.error;

  const manualApprovedVacationsByDate = useMemo(() => {
    const doctorNameById = new Map(
      doctors.map((doctor) => [doctor.id, doctor.name]),
    );
    const map: Record<string, string[]> = {};

    vacationDays.forEach((entry) => {
      if (!entry.approved) return;
      const doctorName =
        entry.doctorName ??
        (typeof entry.doctorId === "number"
          ? doctorNameById.get(entry.doctorId)
          : undefined);
      if (!doctorName) return;

      const names = map[entry.date] ?? [];
      if (!names.includes(doctorName)) {
        names.push(doctorName);
      }
      map[entry.date] = names;
    });

    return map;
  }, [doctors, vacationDays]);

  const automaticNightVacationsByDate = useMemo(() => {
    const automaticVacationDays = getAutomaticNightShiftVacationDays(
      allShifts,
      doctors,
    ).filter((entry) => entry.date.startsWith(`${year}-`));

    return getDoctorNamesByDate(automaticVacationDays);
  }, [allShifts, doctors, year]);

  const combinedApprovedVacationsByDate = useMemo(() => {
    const next: Record<string, string[]> = { ...manualApprovedVacationsByDate };

    Object.entries(automaticNightVacationsByDate).forEach(([date, names]) => {
      const current = next[date] ?? [];
      next[date] = Array.from(new Set([...current, ...names])).sort(
        (left, right) => left.localeCompare(right, "de"),
      );
    });

    return next;
  }, [automaticNightVacationsByDate, manualApprovedVacationsByDate]);

  const assignShiftMutation = useMutation({
    mutationFn: (data: {
      date: string;
      shiftType: string;
      doctorIds: number[];
      expectedVersion?: number;
    }) => shiftsApi.assign(data),
    onSuccess: () => {
      invalidateSchedule(queryClient);
    },
  });

  const invalidateShifts = useCallback(() => {
    return invalidateSchedule(queryClient);
  }, [queryClient]);

  const invalidateMonthPublication = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: ["month-publication", monthKey],
    });
  }, [monthKey, queryClient]);

  const updateMonthPublicationMutation = useMutation({
    mutationFn: (isPublished: boolean) =>
      monthPublicationsApi.update(monthKey, isPublished),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["month-publication", monthKey],
      });
      invalidateSchedule(queryClient);
    },
  });

  return {
    doctors,
    allShifts,
    shiftsLoading,
    dataError,
    vacationDoctorIdsByDate,
    monthPublication,
    monthPublicationLoading,
    unavailableByDoctor,
    approvedVacationsByDate: combinedApprovedVacationsByDate,
    manualApprovedVacationsByDate,
    automaticNightVacationsByDate,
    assignShiftMutation,
    invalidateShifts,
    invalidateMonthPublication,
    updateMonthPublicationMutation,
  };
}
