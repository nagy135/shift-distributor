export const VACATION_COLORS = ["red", "orange", "green"] as const;

export type VacationColor = (typeof VACATION_COLORS)[number];
