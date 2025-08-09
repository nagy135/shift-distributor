"use client";

import { create } from "zustand";
import { addMonths, startOfMonth } from "date-fns";

type MonthState = {
  month: Date;
};

type MonthActions = {
  setMonth: (date: Date) => void;
  nextMonth: () => void;
  prevMonth: () => void;
};

export const useMonthStore = create<MonthState & MonthActions>((set, get) => ({
  month: startOfMonth(new Date()),
  setMonth: (date: Date) => set({ month: startOfMonth(date) }),
  nextMonth: () => set({ month: addMonths(get().month, 1) }),
  prevMonth: () => set({ month: addMonths(get().month, -1) }),
}));


