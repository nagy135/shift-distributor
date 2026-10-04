"use client";

import type { Doctor, VacationDay } from "@/lib/contracts";
import { useAuth } from "@/lib/auth-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiClient } from "@/lib/use-api-client";
import type { VacationColor } from "@/lib/vacations";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { toast } from "sonner";

export function useVacationMutations(year: number, doctors: Doctor[]) {
  const client = useQueryClient();
  const { getSessionGeneration } = useAuth();
  const { vacationsApi } = useApiClient();
  const key = queryKeys.vacations(year);
  const busy = useRef(false);
  const settle = async () => {
    await client.invalidateQueries({ queryKey: ["vacations"] });
    busy.current = false;
  };
  const updateMutation = useMutation({
    scope: { id: "vacation-edit" },
    mutationFn: vacationsApi.edit,
    onMutate: async (changes) => {
      const generation = getSessionGeneration();
      await client.cancelQueries({ queryKey: key });
      if (generation !== getSessionGeneration()) return;
      const previous = client.getQueryData<VacationDay[]>(key) ?? [];
      let next = previous;
      for (const change of changes) {
        next = next.filter(
          (day) => day.doctorId !== change.doctorId || day.date !== change.date,
        );
        if (change.color !== null)
          next = [
            ...next,
            {
              ...change,
              id: -(
                change.doctorId * 100000000 +
                Number(change.date.replaceAll("-", ""))
              ),
              color: change.color,
              approved: false,
              doctorName:
                doctors.find((doctor) => doctor.id === change.doctorId)?.name ??
                null,
            },
          ];
      }
      client.setQueryData(key, next);
      return { previous, generation };
    },
    onError: (error, _, context) => {
      if (context && context.generation === getSessionGeneration())
        client.setQueryData(key, context.previous);
      toast.error(error.message);
    },
    onSettled: settle,
  });
  const approvalMutation = useMutation({
    scope: { id: "vacation-edit" },
    mutationFn: ({
      id,
      approved,
      expectedColor,
    }: {
      id: number;
      approved: boolean;
      expectedColor: string;
    }) => vacationsApi.updateApproval(id, approved, expectedColor),
    onError: (error) => {
      toast.error(error.message);
    },
    onSettled: settle,
  });
  const denyMutation = useMutation({
    scope: { id: "vacation-edit" },
    mutationFn: ({
      id,
      expectedColor,
    }: {
      id: number;
      expectedColor: string;
    }) => vacationsApi.deny(id, expectedColor),
    onError: (error) => {
      toast.error(error.message);
    },
    onSettled: settle,
  });
  const editDay = useCallback(
    (change: {
      doctorId: number;
      date: string;
      color: VacationColor | null;
    }) => {
      if (busy.current) return;
      busy.current = true;
      updateMutation.mutate([change]);
    },
    [updateMutation],
  );
  return { updateMutation, approvalMutation, denyMutation, editDay };
}
