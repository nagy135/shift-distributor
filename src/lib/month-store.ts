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

export const useMonthStore = create<MonthState & MonthActions>()(
  persist(
    (set, get) => ({
      month: startOfMonth(new Date()),
      setMonth: (date: Date) => set({ month: startOfMonth(date) }),
      nextMonth: () => set({ month: addMonths(get().month, 1) }),
      prevMonth: () => set({ month: addMonths(get().month, -1) }),
    }),
    {
      name: "month-state",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ month: state.month }),
    },
  ),
);
