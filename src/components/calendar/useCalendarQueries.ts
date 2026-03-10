"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type UnavailableDate,
  type VacationDay,
} from "@/lib/api";
import { useApiClient } from "@/lib/use-api-client";

export function useCalendarQueries(month: Date) {
  const queryClient = useQueryClient();
  const { doctorsApi, shiftsApi, unavailableDatesApi, vacationsApi } =
    useApiClient();
  const normalizedMonth = month instanceof Date ? month : new Date(month);
  const year = Number.isNaN(normalizedMonth.getTime())
    ? new Date().getFullYear()
    : normalizedMonth.getFullYear();

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
      doctors?.map((doctor) => `${doctor.id}:${doctor.color ?? ""}`).join("|"),
    ],
    queryFn: async () => {
      const entries = await Promise.all(
        (doctors ?? []).map(async (doctor) => {
          const records: UnavailableDate[] =
            await unavailableDatesApi.getByDoctor(doctor.id);
          return [
            doctor.id,
            new Set(records.map((record) => record.date)),
          ] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<number, Set<string>>;
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

  return {
    doctors,
    allShifts,
    shiftsLoading,
    unavailableByDoctor,
    approvedVacationsByDate,
    assignShiftMutation,
    invalidateShifts,
  };
}
