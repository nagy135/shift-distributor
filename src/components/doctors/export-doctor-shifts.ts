import { getDoctorShiftsForMonth } from "@/components/doctors/utils";
import type { Doctor, Shift } from "@/lib/api";
import { getShiftLabel } from "@/lib/shifts";
import { format } from "date-fns";
import { de } from "date-fns/locale";

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
    Datum: format(new Date(`${shift.date}T12:00:00`), "d. MMM yyyy", {
      locale: de,
    }),
    Dienst: getShiftLabel(shift.shiftType),
  }));

  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet("Dienste");
  sheet.columns = [
    { header: "Datum", key: "Datum", width: 24 },
    { header: "Dienst", key: "Dienst", width: 30 },
  ];
  sheet.addRows(rows);

  const safeName = doctor.name.replace(/[^\w\-]+/g, "_");
  const fileName = `${safeName}-${format(month, "yyyy-MM")}-dienste.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(buffer).buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}
