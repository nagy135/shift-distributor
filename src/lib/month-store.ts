"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { addMonths, startOfMonth } from "date-fns";

type MonthState = {
  month: Date;
};

type MonthActions = {
  setMonth: (date: Date) => void;
  nextMonth: () => void;
  prevMonth: () => void;
};

function normalizeMonth(value: unknown): Date {
  const parsedMonth =
    value instanceof Date
      ? value
      : typeof value === "string" || typeof value === "number"
        ? new Date(value)
        : null;

  if (!parsedMonth || Number.isNaN(parsedMonth.getTime())) {
    return startOfMonth(new Date());
  }

  return startOfMonth(parsedMonth);
}

export const useMonthStore = create<MonthState & MonthActions>()(
  persist(
    (set, get) => ({
      month: startOfMonth(new Date()),
      setMonth: (date: Date) => set({ month: normalizeMonth(date) }),
      nextMonth: () => set({ month: addMonths(normalizeMonth(get().month), 1) }),
      prevMonth: () => set({ month: addMonths(normalizeMonth(get().month), -1) }),
    }),
    {
      name: "month-state",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ month: state.month }),
      merge: (persistedState, currentState) => {
        const persistedMonth =
          persistedState &&
          typeof persistedState === "object" &&
          "month" in persistedState
            ? (persistedState as { month?: unknown }).month
            : undefined;

        return {
          ...currentState,
          ...(persistedState as Partial<MonthState & MonthActions> | undefined),
          month: normalizeMonth(persistedMonth ?? currentState.month),
        };
      },
    },
  ),
);
