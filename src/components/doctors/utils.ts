import { isSameMonth } from "date-fns";
import type { Doctor, Shift } from "@/lib/api";

export function getAllDatesInMonth(month: Date | string): Date[] {
  const monthDate = month instanceof Date ? month : new Date(month);
  const year = monthDate.getFullYear();
  const monthIndex = monthDate.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const dates: Date[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    dates.push(new Date(year, monthIndex, day));
  }

  return dates;
}

export function getDoctorShiftCount(
  doctorId: number,
  shifts: Shift[],
  month: Date,
) {
  return shifts.filter(
    (shift) =>
      Array.isArray(shift.doctorIds) &&
      shift.doctorIds.includes(doctorId) &&
      isSameMonth(new Date(shift.date), month),
  ).length;
}

export function getDoctorShifts(doctorId: number, shifts: Shift[]) {
  return shifts
    .filter(
      (shift) =>
        Array.isArray(shift.doctorIds) && shift.doctorIds.includes(doctorId),
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function getDoctorShiftsForMonth(
  doctorId: number,
  month: Date,
  shifts: Shift[],
) {
  return getDoctorShifts(doctorId, shifts).filter((shift) =>
    isSameMonth(new Date(shift.date), month),
  );
}

export function matchesDoctorSearch(doctor: Doctor, query: string): boolean {
  const normalize = (value: string) =>
    value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("de");

  return normalize(doctor.name).includes(normalize(query.trim()));
}
