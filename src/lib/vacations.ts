export const VACATION_COLORS = ["red", "orange", "yellow", "blue"] as const;

export const AUTO_GENERATED_VACATION_COLOR = "green" as const;

export const DISPLAY_VACATION_COLORS = [
  ...VACATION_COLORS,
  AUTO_GENERATED_VACATION_COLOR,
] as const;

export type VacationColor = (typeof VACATION_COLORS)[number];
export type DisplayVacationColor = (typeof DISPLAY_VACATION_COLORS)[number];

export const VACATION_COLOR_STYLES: Record<
  DisplayVacationColor,
  { label: string; classes: string; ring: string; questionMark: string }
> = {
  red: {
    label: "Rot",
    classes: "bg-red-600 text-white hover:bg-red-700",
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
  green: {
    label: "Gruen",
    classes: "bg-green-600 text-white hover:bg-green-500",
    ring: "ring-green-600",
    questionMark: "text-white",
  },
};

export const VACATION_DAYS_PER_YEAR: Record<VacationColor, number> = {
  red: 10,
  orange: 5,
  yellow: 15,
  blue: Number.POSITIVE_INFINITY,
};

export interface VacationQuotaIssue {
  color: VacationColor;
  used: number;
  limit: number;
  excess: number;
}

export function getVacationQuotaIssues(
  days: readonly { doctorId: number; date: string; color: string }[],
  year: number,
): Map<number, VacationQuotaIssue[]> {
  const countsByDoctor = new Map<number, Map<VacationColor, number>>();
  for (const day of days) {
    const color = day.color as VacationColor;
    if (
      !day.date.startsWith(`${year}-`) ||
      !Number.isFinite(VACATION_DAYS_PER_YEAR[color])
    )
      continue;
    const counts = countsByDoctor.get(day.doctorId) ?? new Map();
    counts.set(color, (counts.get(color) ?? 0) + 1);
    countsByDoctor.set(day.doctorId, counts);
  }

  const issuesByDoctor = new Map<number, VacationQuotaIssue[]>();
  for (const [doctorId, counts] of countsByDoctor) {
    const issues = VACATION_COLORS.flatMap((color) => {
      const used = counts.get(color) ?? 0;
      const limit = VACATION_DAYS_PER_YEAR[color];
      return used > limit ? [{ color, used, limit, excess: used - limit }] : [];
    });
    if (issues.length > 0) issuesByDoctor.set(doctorId, issues);
  }
  return issuesByDoctor;
}

export function formatVacationQuotaIssue(issue: VacationQuotaIssue): string {
  return `${VACATION_COLOR_STYLES[issue.color].label}: ${issue.used} von ${issue.limit} Tagen (${issue.excess} ${issue.excess === 1 ? "Tag" : "Tage"} zu viel)`;
}
