"use client";

import { type UnavailableDate, type UnavailableDateChangeLog } from "@/lib/api";
import {
  invalidateDoctors,
  invalidateSchedule,
  queryKeys,
} from "@/lib/query-keys";
import { useApiClient } from "@/lib/use-api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type UseDoctorsQueriesOptions = {
  selectedDoctorId?: number;
  canViewUnavailableLogs?: boolean;
  onDoctorCreated?: () => void;
  onUnavailableUpdated?: () => void;
  onDoctorUpdated?: () => void;
};

export function useDoctorsQueries({
  selectedDoctorId,
  canViewUnavailableLogs = false,
  onDoctorCreated,
  onUnavailableUpdated,
  onDoctorUpdated,
}: UseDoctorsQueriesOptions) {
  const queryClient = useQueryClient();
  const { doctorsApi, unavailableDatesApi, shiftsApi } = useApiClient();

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

  const {
    data: unavailableDateLogs = [],
    isFetching: isUnavailableDateLogsFetching,
  } = useQuery({
    queryKey: ["unavailable-date-logs", selectedDoctorId],
    queryFn: () =>
      selectedDoctorId
        ? unavailableDatesApi.getLogs(selectedDoctorId)
        : Promise.resolve([] as UnavailableDateChangeLog[]),
    enabled: !!selectedDoctorId && canViewUnavailableLogs,
  });

  const { data: allShifts = [] } = useQuery({
    queryKey: queryKeys.shifts(),
    queryFn: () => shiftsApi.getAll(),
  });

  const createDoctorMutation = useMutation({
    mutationFn: doctorsApi.create,
    onSuccess: () => {
      invalidateDoctors(queryClient);
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
        queryClient.invalidateQueries({
          queryKey: ["unavailable-date-logs", selectedDoctorId],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["unavailable-by-doctor"] });
      invalidateSchedule(queryClient);
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
      invalidateDoctors(queryClient);
      invalidateSchedule(queryClient);
      onDoctorUpdated?.();
    },
  });

  return {
    doctors,
    unavailableDates,
    unavailableDateLogs,
    isUnavailableDatesFetching,
    isUnavailableDateLogsFetching,
    allShifts,
    createDoctorMutation,
    updateUnavailableDatesMutation,
    updateDoctorMutation,
  };
}
