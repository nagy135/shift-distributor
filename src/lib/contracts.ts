import type { UserRole } from "@/lib/roles";
import type { VacationColor } from "@/lib/vacations";

export interface Doctor {
  id: number;
  name: string;
  color?: string | null;
  unavailableShiftTypes: string[];
  disabled: boolean;
  oa: boolean;
  createdAt: string | null;
}

export interface ShiftDoctor {
  id: number;
  name: string;
  color?: string | null;
}

export interface Shift {
  id: number;
  date: string;
  shiftType: string;
  doctorIds: number[];
  version: number;
  doctors: ShiftDoctor[];
}

export interface NightShift {
  id: number;
  date: string;
  shiftType: "night";
  doctorIds: number[];
  version: number;
  doctors: ShiftDoctor[];
}

export interface UnavailableDate {
  id: number;
  doctorId: number;
  date: string;
}

export interface UnavailableDateChange {
  date: string;
  changeType: "added" | "removed";
}

export interface UnavailableDateChangeLog {
  id: number;
  doctorId: number;
  userId: number;
  userEmail: string;
  addedCount: number;
  removedCount: number;
  createdAt: number | string;
  changes: UnavailableDateChange[];
}

export interface VacationDay {
  id: number;
  doctorId: number;
  date: string;
  color: VacationColor;
  approved: boolean;
  doctorName: string | null;
}

export interface Notification {
  id: number;
  message: string;
  createdAt?: number | string | null;
}

export interface MonthPublication {
  month: string;
  isPublished: boolean;
  publishedAt?: number | string | null;
  publishedByUserId?: number | null;
  updatedAt?: number | string | null;
}

export interface MonthCalendarEmailDelivery {
  email: string;
  doctorName: string;
  shiftCount: number;
  outputPath: string | null;
  messageId: string | null;
}

export interface MonthCalendarEmailSkip {
  email: string;
  reason: string;
}

export interface MonthCalendarEmailResult {
  month: string;
  scope: "shifts" | "departments";
  mode: "mock" | "smtp";
  mockBasePath: string | null;
  revision: string;
  deliveredCount: number;
  skippedCount: number;
  deliveries: MonthCalendarEmailDelivery[];
  skipped: MonthCalendarEmailSkip[];
}

export interface AdminUser {
  id: number;
  email: string;
  role: UserRole;
  admin: boolean;
  doctorId?: number | null;
  doctorName?: string | null;
  lastOnlineAt?: number | string | null;
  isOnline?: boolean;
  createdAt?: number | string | null;
}
