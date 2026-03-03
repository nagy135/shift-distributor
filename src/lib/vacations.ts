export const VACATION_COLORS = ["red", "orange", "yellow"] as const;

export type VacationColor = (typeof VACATION_COLORS)[number];

export const VACATION_COLOR_STYLES: Record<
  VacationColor,
  { label: string; classes: string; ring: string }
> = {
  red: {
    label: "Rot",
    classes: "bg-red-600 text-white hover:bg-red-400",
    ring: "ring-red-600",
  },
  orange: {
    label: "Orange",
    classes: "bg-orange-500 text-white hover:bg-orange-600",
    ring: "ring-orange-500",
  },
  yellow: {
    label: "Gelb",
    classes: "bg-yellow-300 text-black hover:bg-yellow-200",
    ring: "ring-yellow-300",
  },
};

export const VACATION_DAYS_PER_YEAR: Record<VacationColor, number> = {
  red: 10,
  orange: 5,
  yellow: 15,
};
