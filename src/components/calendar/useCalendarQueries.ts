"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  doctorsApi,
  shiftsApi,
  unavailableDatesApi,
  type UnavailableDate,
} from "@/lib/api";

export function useCalendarQueries() {
  const queryClient = useQueryClient();

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

  const assignShiftMutation = useMutation({
    mutationFn: shiftsApi.assign,
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
    assignShiftMutation,
    invalidateShifts,
  };
}
