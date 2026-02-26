import { format } from "date-fns";
import { SHIFT_LABELS } from "@/lib/shifts";
import type { Doctor, Shift } from "@/lib/api";
import { getDoctorShiftsForMonth } from "@/components/doctors/utils";

type ExportDoctorShiftsParams = {
  doctor: Doctor;
  month: Date;
  shifts: Shift[];
};

export async function exportDoctorShifts({
  doctor,
  month,
  shifts,
}: ExportDoctorShiftsParams) {
  const monthlyShifts = getDoctorShiftsForMonth(doctor.id, month, shifts);
  if (monthlyShifts.length === 0) return false;

  const rows = monthlyShifts.map((shift) => ({
    Date: format(new Date(shift.date), "MMM d, yyyy"),
    Shift:
      SHIFT_LABELS[shift.shiftType as keyof typeof SHIFT_LABELS] ??
      shift.shiftType,
  }));

  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Shifts");

  const safeName = doctor.name.replace(/[^\w\-]+/g, "_");
  const fileName = `${safeName}-${format(month, "yyyy-MM")}-shifts.xlsx`;
  XLSX.writeFile(workbook, fileName);
  return true;
}
