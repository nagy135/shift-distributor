"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminUser } from "@/lib/api";
import { useAuth } from "@/lib/auth-client";
import { useApiClient } from "@/lib/use-api-client";

export function useAdminUsersQueries(enabled: boolean) {
  const queryClient = useQueryClient();
  const { adminUsersApi, doctorsApi } = useApiClient();
  const { user, reloadUser } = useAuth();

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: adminUsersApi.getAll,
    enabled,
    refetchInterval: enabled ? 15_000 : false,
  });

  const doctorsQuery = useQuery({
    queryKey: ["admin-users", "doctors"],
    queryFn: doctorsApi.getAll,
    enabled,
    select: (doctors) => doctors.slice().sort((left, right) => left.name.localeCompare(right.name)),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: number;
      payload: Parameters<typeof adminUsersApi.update>[1];
    }) => adminUsersApi.update(userId, payload),
    onSuccess: async (updatedUser) => {
      queryClient.setQueryData<AdminUser[]>(["admin-users"], (currentUsers) =>
        (currentUsers ?? []).map((user) =>
          user.id === updatedUser.id ? { ...user, ...updatedUser } : user,
        ),
      );

      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });

      if (updatedUser.id === user?.id) {
        await reloadUser();
      }
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) => adminUsersApi.remove(userId),
    onSuccess: (_, deletedUserId) => {
      queryClient.setQueryData<AdminUser[]>(["admin-users"], (currentUsers) =>
        (currentUsers ?? []).filter((user) => user.id !== deletedUserId),
      );
    },
  });

  return {
    usersQuery,
    doctorsQuery,
    updateUserMutation,
    deleteUserMutation,
  };
}
