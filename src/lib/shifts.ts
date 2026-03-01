export const SHIFT_TYPES = ["night", "20shift", "17shift", "oa"] as const;
export type ShiftType = (typeof SHIFT_TYPES)[number];

export const AUTO_DISTRIBUTE_SHIFT_TYPES = ["20shift", "17shift"] as const;
export type AutoDistributeShiftType =
  (typeof AUTO_DISTRIBUTE_SHIFT_TYPES)[number];

export const SHIFT_DEFS: Record<
  ShiftType,
  { label: string; weekendOnly: boolean; acronym?: string }
> = {
  "17shift": { label: "Stationsdienst", acronym: "KD", weekendOnly: true },
  "20shift": { label: "Spätdienst", acronym: "LD", weekendOnly: false },
  night: { label: "Nachtdient", acronym: "ND", weekendOnly: true },
  oa: { label: "OA", weekendOnly: false },
};

export const SHIFT_LABELS: Record<ShiftType, string> = Object.fromEntries(
  (SHIFT_TYPES as readonly ShiftType[]).map((t) => [t, SHIFT_DEFS[t].label]),
) as Record<ShiftType, string>;

export const isWeekendOnly = (type: ShiftType): boolean =>
  SHIFT_DEFS[type].weekendOnly;
