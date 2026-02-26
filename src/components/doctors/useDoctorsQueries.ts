"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  doctorsApi,
  unavailableDatesApi,
  shiftsApi,
  type UnavailableDate,
} from "@/lib/api";

type UseDoctorsQueriesOptions = {
  selectedDoctorId?: number;
  onDoctorCreated?: () => void;
  onUnavailableUpdated?: () => void;
  onDoctorUpdated?: () => void;
};

export function useDoctorsQueries({
  selectedDoctorId,
  onDoctorCreated,
  onUnavailableUpdated,
  onDoctorUpdated,
}: UseDoctorsQueriesOptions) {
  const queryClient = useQueryClient();

  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors"],
    queryFn: doctorsApi.getAll,
  });

  const { data: unavailableDates, isFetching: isUnavailableDatesFetching } =
    useQuery({
      queryKey: ["unavailable-dates", selectedDoctorId],
      queryFn: () =>
        selectedDoctorId
          ? unavailableDatesApi.getByDoctor(selectedDoctorId)
          : Promise.resolve([] as UnavailableDate[]),
      enabled: !!selectedDoctorId,
    });

  const { data: allShifts = [] } = useQuery({
    queryKey: ["shifts"],
    queryFn: shiftsApi.getAll,
  });

  const createDoctorMutation = useMutation({
    mutationFn: doctorsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      onDoctorCreated?.();
    },
  });

  const updateUnavailableDatesMutation = useMutation({
    mutationFn: ({ doctorId, dates }: { doctorId: number; dates: string[] }) =>
      unavailableDatesApi.update(doctorId, dates),
    onSuccess: () => {
      if (selectedDoctorId) {
        queryClient.invalidateQueries({
          queryKey: ["unavailable-dates", selectedDoctorId],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["unavailable-by-doctor"] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      onUnavailableUpdated?.();
    },
  });

  const updateDoctorMutation = useMutation({
    mutationFn: ({
      id,
      color,
      name,
      unavailableShiftTypes,
      disabled,
      oa,
    }: {
      id: number;
      color: string | null;
      name: string;
      unavailableShiftTypes: string[];
      disabled: boolean;
      oa: boolean;
    }) =>
      doctorsApi.update(id, {
        color: color ?? null,
        name,
        unavailableShiftTypes,
        disabled,
        oa,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      onDoctorUpdated?.();
    },
  });

  return {
    doctors,
    unavailableDates,
    isUnavailableDatesFetching,
    allShifts,
    createDoctorMutation,
    updateUnavailableDatesMutation,
    updateDoctorMutation,
  };
}
