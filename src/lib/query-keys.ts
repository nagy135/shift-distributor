import type { QueryClient } from "@tanstack/react-query";

export const queryKeys = {
  doctors: ["doctors"] as const,
  shifts: (range?: { start: string; end: string }) =>
    ["shifts", range ?? "all"] as const,
  nightShifts: (year: number) => ["night-shifts", year] as const,
  vacations: (year: number) => ["vacations", year] as const,
};

export function invalidateSchedule(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: ["shifts"] }),
    client.invalidateQueries({ queryKey: ["night-shifts"] }),
  ]);
}
export function invalidateDoctors(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.doctors }),
    invalidateSchedule(client),
    client.invalidateQueries({ queryKey: ["vacations"] }),
  ]);
}
