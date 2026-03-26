import { NIGHT_FREE_COLUMN_ID } from "@/lib/night-shift-vacations";

type DepartmentDefinition = {
  id?: string;
  label: string;
  count: number;
  headerNote?: string | readonly string[];
};

export type CalendarShiftColumn = {
  id: string;
  label: string;
  slotLabel?: string;
  headerNote?: string;
};

export type ShiftTimeRange = {
  from: `${number}:${number}`;
  to: `${number}:${number}`;
};

export const SHIFT_TYPES = ["night", "20shift", "17shift", "oa"] as const;
export type ShiftType = (typeof SHIFT_TYPES)[number];
const SHIFT_TYPE_SET = new Set<string>(SHIFT_TYPES);

export const AUTO_DISTRIBUTE_SHIFT_TYPES = ["20shift", "17shift"] as const;
export type AutoDistributeShiftType =
  (typeof AUTO_DISTRIBUTE_SHIFT_TYPES)[number];

export const UNAVAILABLE_DATE_CLASH_SHIFT_TYPES = [
  "20shift",
  "17shift",
] as const;

export const SHIFT_DEFS: Record<
  ShiftType,
  { label: string; weekendOnly: boolean; acronym?: string }
> = {
  "17shift": { label: "Stationsdienst", acronym: "KD", weekendOnly: true },
  "20shift": { label: "Spätdienst", acronym: "LD", weekendOnly: false },
  night: { label: "Nachtdienst", acronym: "ND", weekendOnly: true },
  oa: { label: "OA", weekendOnly: false },
};

export const SHIFT_LABELS: Record<ShiftType, string> = Object.fromEntries(
  (SHIFT_TYPES as readonly ShiftType[]).map((t) => [t, SHIFT_DEFS[t].label]),
) as Record<ShiftType, string>;

export const SHIFT_TIME_RANGES: Partial<Record<ShiftType, ShiftTimeRange>> = {
  // "17shift": {
  //   from: "12:00",
  //   to: "17:00",
  // },
};

export const SHIFT_TABLE_COLUMNS: readonly CalendarShiftColumn[] = (
  SHIFT_TYPES as readonly ShiftType[]
).map((shiftType) => ({
  id: shiftType,
  label: SHIFT_LABELS[shiftType],
}));

export const DEPARTMENT_DEFS: readonly DepartmentDefinition[] = [
  { label: "INT", count: 2, headerNote: ["8:00-16:30", "14:00-22:30"] },
  { label: "INA", count: 1 },
  { label: "A1.1", count: 1, headerNote: "INN" },
  { label: "A1.4", count: 1, headerNote: "INN" },
  { label: "500", count: 1, headerNote: "INN" },
  { label: "C-600", count: 1, headerNote: "INN" },
  { label: "Senior", count: 2 },
  { label: "A3.1", count: 1, headerNote: "GER" },
  { label: "A3.2", count: 1, headerNote: "GER" },
  { label: "A4.1", count: 1, headerNote: "GER/INN" },
  { label: "A4.2", count: 1, headerNote: "GER/INN" },
];

export const DEPARTMENT_SHIFT_COLUMNS: readonly CalendarShiftColumn[] = (() => {
  const totalCountsByLabel = new Map<string, number>();

  for (const definition of DEPARTMENT_DEFS) {
    totalCountsByLabel.set(
      definition.label,
      (totalCountsByLabel.get(definition.label) ?? 0) + definition.count,
    );
  }

  const usedCountsByLabel = new Map<string, number>();

  const departmentColumns = DEPARTMENT_DEFS.flatMap((definition) =>
    Array.from({ length: definition.count }, (_, slotIndex) => {
      const nextIndex = (usedCountsByLabel.get(definition.label) ?? 0) + 1;
      usedCountsByLabel.set(definition.label, nextIndex);

      const hasDuplicates =
        (totalCountsByLabel.get(definition.label) ?? 0) > 1;
      const headerNote = Array.isArray(definition.headerNote)
        ? definition.headerNote[slotIndex]
        : definition.headerNote;

      return {
        id: definition.id
          ? definition.count > 1
            ? `${definition.id}-${nextIndex}`
            : definition.id
          : hasDuplicates
            ? `${definition.label}-${nextIndex}`
            : definition.label,
        label: definition.label,
        slotLabel: hasDuplicates
          ? `${definition.label} ${nextIndex}`
          : definition.label,
        headerNote,
      };
    }),
  );

  return [
    ...departmentColumns,
    {
      id: "night",
      label: "ND",
      slotLabel: "ND",
    },
    {
      id: NIGHT_FREE_COLUMN_ID,
      label: "ND-frei",
    },
  ];
})();

export const DEPARTMENT_SHIFT_TYPES: readonly string[] =
  DEPARTMENT_SHIFT_COLUMNS
    .filter((column) => column.id !== NIGHT_FREE_COLUMN_ID)
    .map((column) => column.id);

export const ALL_CALENDAR_SHIFT_TYPES: readonly string[] = Array.from(
  new Set([...SHIFT_TYPES, ...DEPARTMENT_SHIFT_TYPES]),
);

const DEPARTMENT_SHIFT_TYPE_SET = new Set<string>(DEPARTMENT_SHIFT_TYPES);

const DEPARTMENT_SHIFT_LABELS = Object.fromEntries(
  DEPARTMENT_SHIFT_COLUMNS.map((column) => [
    column.id,
    column.slotLabel ?? column.label,
  ]),
) as Record<string, string>;

const CALENDAR_SHIFT_LABELS: Record<string, string> = {
  ...SHIFT_LABELS,
  ...DEPARTMENT_SHIFT_LABELS,
};

export const isWeekendOnly = (type: ShiftType): boolean =>
  SHIFT_DEFS[type].weekendOnly;

export const isShiftType = (value: string): value is ShiftType =>
  SHIFT_TYPE_SET.has(value);

export const getShiftLabel = (value: string): string =>
  CALENDAR_SHIFT_LABELS[value] ?? value;

export const doesUnavailableDateClash = (type: ShiftType): boolean =>
  type === "20shift" || type === "17shift";

export const doesCalendarShiftUnavailableDateClash = (
  value: string,
): boolean =>
  isShiftType(value)
    ? doesUnavailableDateClash(value)
    : DEPARTMENT_SHIFT_TYPE_SET.has(value);

export const isDayDutyShiftType = (value: string): boolean =>
  value !== "night" && value !== "oa";
