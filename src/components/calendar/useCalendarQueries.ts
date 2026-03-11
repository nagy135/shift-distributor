"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  type MonthPublication,
  type UnavailableDate,
  type VacationDay,
} from "@/lib/api";
import { useApiClient } from "@/lib/use-api-client";

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

  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors"],
    queryFn: doctorsApi.getAll,
  });

  const { data: allShifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: [
      "shifts",
      doctors?.map((doctor) => `${doctor.id}:${doctor.color ?? ""}`).join("|"),
    ],
    queryFn: shiftsApi.getAll,
  });

  const { data: unavailableByDoctor = {} } = useQuery({
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

  const { data: vacationDays = [] } = useQuery({
    queryKey: ["vacations", "calendar", year],
    queryFn: async (): Promise<VacationDay[]> => {
      try {
        return await vacationsApi.getByYear(year);
      } catch {
        return [];
      }
    },
  });

  const {
    data: monthPublication = {
      month: monthKey,
      isPublished: true,
      publishedAt: null,
      publishedByUserId: null,
      updatedAt: null,
    } satisfies MonthPublication,
    isLoading: monthPublicationLoading,
  } = useQuery({
    queryKey: ["month-publication", monthKey],
    queryFn: () => monthPublicationsApi.getByMonth(monthKey),
  });

  const approvedVacationsByDate = useMemo(() => {
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

  const assignShiftMutation = useMutation({
    mutationFn: (data: {
      date: string;
      shiftType: string;
      doctorIds: number[];
    }) => shiftsApi.assign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });

  const invalidateShifts = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: ["shifts"] });
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
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });

  return {
    doctors,
    allShifts,
    shiftsLoading,
    monthPublication,
    monthPublicationLoading,
    unavailableByDoctor,
    approvedVacationsByDate,
    assignShiftMutation,
    invalidateShifts,
    invalidateMonthPublication,
    updateMonthPublicationMutation,
  };
}
