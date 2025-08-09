"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type DistributeLockState = {
  isLocked: boolean;
  setLocked: (locked: boolean) => void;
  toggleLocked: () => void;
};

export const useDistributeLockStore = create<DistributeLockState>()(
  persist(
    (set, get) => ({
      isLocked: true,
      setLocked: (locked: boolean) => set({ isLocked: locked }),
      toggleLocked: () => set({ isLocked: !get().isLocked }),
    }),
    {
      name: "distribute-lock-state",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ isLocked: state.isLocked }),
    }
  )
);


