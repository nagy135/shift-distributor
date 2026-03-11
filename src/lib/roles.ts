import { DEPARTMENT_SHIFT_TYPES, SHIFT_TYPES } from "@/lib/shifts";

export const USER_ROLES = [
  "doctor",
  "shift_assigner",
  "department_assigner",
  "secretary",
] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type AssignerRole = Extract<
  UserRole,
  "shift_assigner" | "department_assigner"
>;

export const DEFAULT_USER_ROLE: UserRole = "doctor";

const SHIFT_TABLE_SHIFT_TYPE_SET = new Set<string>(SHIFT_TYPES);
const DEPARTMENT_TABLE_SHIFT_TYPE_SET = new Set<string>(DEPARTMENT_SHIFT_TYPES);

export function isAssigner(role: UserRole | null | undefined): role is AssignerRole {
  return role === "shift_assigner" || role === "department_assigner";
}

export function isShiftAssigner(role: UserRole | null | undefined): boolean {
  return role === "shift_assigner";
}

export function isDepartmentAssigner(
  role: UserRole | null | undefined,
): boolean {
  return role === "department_assigner";
}

export function canEditCalendarView(
  role: UserRole | null | undefined,
  view: "shifts" | "departments",
): boolean {
  return view === "shifts" ? isShiftAssigner(role) : isDepartmentAssigner(role);
}

export function canAssignCalendarShiftType(
  role: UserRole | null | undefined,
  shiftType: string,
): boolean {
  if (isShiftAssigner(role)) {
    return SHIFT_TABLE_SHIFT_TYPE_SET.has(shiftType);
  }

  if (isDepartmentAssigner(role)) {
    return DEPARTMENT_TABLE_SHIFT_TYPE_SET.has(shiftType);
  }

  return false;
}
