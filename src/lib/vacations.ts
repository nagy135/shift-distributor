export const VACATION_COLORS = ["red", "orange", "yellow", "blue"] as const;

export type VacationColor = (typeof VACATION_COLORS)[number];

export const VACATION_COLOR_STYLES: Record<
  VacationColor,
  { label: string; classes: string; ring: string; questionMark: string }
> = {
  red: {
    label: "Rot",
    classes: "bg-red-600 text-white hover:bg-red-400",
    ring: "ring-red-600",
    questionMark: "text-white",
  },
  orange: {
    label: "Orange",
    classes: "bg-orange-500 text-white hover:bg-orange-600",
    ring: "ring-orange-500",
    questionMark: "text-white",
  },
  yellow: {
    label: "Gelb",
    classes: "bg-yellow-300 text-black hover:bg-yellow-200",
    ring: "ring-yellow-300",
    questionMark: "text-black",
  },
  blue: {
    label: "Blau",
    classes: "bg-blue-600 text-white hover:bg-blue-500",
    ring: "ring-blue-600",
    questionMark: "text-white",
  },
};

export const VACATION_DAYS_PER_YEAR: Record<VacationColor, number> = {
  red: 10,
  orange: 5,
  yellow: 15,
  blue: Number.POSITIVE_INFINITY,
};
