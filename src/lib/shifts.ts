type DepartmentDefinition = {
  count: number;
  headerNote?: string;
};

export type CalendarShiftColumn = {
  id: string;
  label: string;
  slotLabel?: string;
  headerNote?: string;
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

export const SHIFT_TABLE_COLUMNS: readonly CalendarShiftColumn[] = (
  SHIFT_TYPES as readonly ShiftType[]
).map((shiftType) => ({
  id: shiftType,
  label: SHIFT_LABELS[shiftType],
}));

export const DEPARTMENT_DEFS = {
  INT: { count: 1 },
  INA: { count: 1 },
  "A1.1": { count: 1, headerNote: "INN" },
  "A1.4": { count: 1, headerNote: "INN" },
  "500": { count: 1, headerNote: "INN" },
  "C-600": { count: 1, headerNote: "INN" },
  Senior: { count: 2 },
  "A3.1": { count: 1, headerNote: "GER" },
  "A3.2": { count: 1, headerNote: "GER" },
  "A4.1": { count: 1, headerNote: "GER/INN" },
  "A4.2": { count: 1, headerNote: "GER/INN" },
  ND: { count: 1 },
  "ND-frei": { count: 1 },
} as const satisfies Record<string, DepartmentDefinition>;

export const DEPARTMENT_SHIFT_COLUMNS: readonly CalendarShiftColumn[] =
  Object.entries(DEPARTMENT_DEFS).flatMap(([department, definition]) =>
    Array.from({ length: definition.count }, (_, index) => ({
      id:
        definition.count > 1 ? `${department}-${index + 1}` : department,
      label: department,
      slotLabel:
        definition.count > 1 ? `${department} ${index + 1}` : department,
      headerNote:
        "headerNote" in definition ? definition.headerNote : undefined,
    })),
  );

export const DEPARTMENT_SHIFT_TYPES: readonly string[] =
  DEPARTMENT_SHIFT_COLUMNS.map((column) => column.id);

export const ALL_CALENDAR_SHIFT_TYPES: readonly string[] = [
  ...SHIFT_TYPES,
  ...DEPARTMENT_SHIFT_TYPES,
];

const DEPARTMENT_SHIFT_TYPE_SET = new Set<string>(DEPARTMENT_SHIFT_TYPES);

const DEPARTMENT_SHIFT_LABELS = Object.fromEntries(
  DEPARTMENT_SHIFT_COLUMNS.map((column) => [column.id, column.slotLabel ?? column.label]),
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
