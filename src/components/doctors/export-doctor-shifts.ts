import { format } from "date-fns";
import { de } from "date-fns/locale";
import { getShiftLabel } from "@/lib/shifts";
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
    Datum: format(new Date(shift.date), "d. MMM yyyy", { locale: de }),
    Dienst: getShiftLabel(shift.shiftType),
  }));

  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Dienste");

  const safeName = doctor.name.replace(/[^\w\-]+/g, "_");
  const fileName = `${safeName}-${format(month, "yyyy-MM")}-dienste.xlsx`;
  XLSX.writeFile(workbook, fileName);
  return true;
}
