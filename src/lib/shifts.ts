export const SHIFT_TYPES = ['17shift', '20shift'] as const
export type ShiftType = typeof SHIFT_TYPES[number]

export const SHIFT_LABELS: Record<ShiftType, string> = {
  '17shift': '17 Shift',
  '20shift': '20 Shift',
}


