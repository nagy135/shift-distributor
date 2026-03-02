export const VACATION_COLORS = ["red", "orange", "green"] as const;

export type VacationColor = (typeof VACATION_COLORS)[number];

export const VACATION_COLOR_STYLES: Record<
  VacationColor,
  { label: string; classes: string; ring: string }
> = {
  red: {
    label: "Red",
    classes: "bg-red-500 text-white hover:bg-red-600",
    ring: "ring-red-500",
  },
  orange: {
    label: "Orange",
    classes: "bg-orange-500 text-white hover:bg-orange-600",
    ring: "ring-orange-500",
  },
  green: {
    label: "Green",
    classes: "bg-emerald-500 text-white hover:bg-emerald-600",
    ring: "ring-emerald-500",
  },
};
