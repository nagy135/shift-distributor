export const SHIFT_TYPES = ['17shift', '20shift'] as const
export type ShiftType = typeof SHIFT_TYPES[number]

export const SHIFT_DEFS: Record<ShiftType, { label: string; weekendOnly: boolean }> = {
  '17shift': { label: '17 Shift', weekendOnly: true },
  '20shift': { label: '20 Shift', weekendOnly: false },
}

export const SHIFT_LABELS: Record<ShiftType, string> = Object.fromEntries(
  (SHIFT_TYPES as readonly ShiftType[]).map((t) => [t, SHIFT_DEFS[t].label])
) as Record<ShiftType, string>

export const isWeekendOnly = (type: ShiftType): boolean => SHIFT_DEFS[type].weekendOnly


