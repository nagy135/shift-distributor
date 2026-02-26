import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
} from "date-fns";
import { de } from "date-fns/locale";
import { SHIFT_TYPES, isWeekendOnly, type ShiftType } from "@/lib/shifts";
import type { Shift } from "@/lib/api";

type ExportMonthTableParams = {
  month: Date;
  allShifts: Shift[];
};

type BorderStyle = { style: "thin"; color: { argb: string } };
type ExcelCell = {
  border?: {
    top: BorderStyle;
    left: BorderStyle;
    bottom: BorderStyle;
    right: BorderStyle;
  };
  alignment?: { vertical?: string; horizontal?: string };
  font?: { bold?: boolean };
  fill?: { type: "pattern"; pattern: "solid"; fgColor: { argb: string } };
};
type ExcelRow = {
  height?: number;
  eachCell: (callback: (cell: ExcelCell, colNumber: number) => void) => void;
};
type ExcelWorksheet = {
  columns: { width: number }[];
  addRow: (values: Array<string | number | null | undefined>) => ExcelRow;
  getCell: (row: number, col: number) => ExcelCell;
  lastRow?: { number: number };
};
type ExcelWorkbook = {
  addWorksheet: (
    name: string,
    opts?: {
      properties?: { defaultRowHeight?: number };
      views?: Array<{ state?: string; ySplit?: number }>;
    },
  ) => ExcelWorksheet;
  xlsx: { writeBuffer: () => Promise<ArrayBuffer> };
};
type ExcelJSPackage = { Workbook: new () => ExcelWorkbook };

export async function exportMonthTable({
  month,
  allShifts,
}: ExportMonthTableParams) {
  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });

  const shiftIndex = new Map<string, Partial<Record<ShiftType, Shift>>>();
  for (const shift of allShifts) {
    const dateObj = new Date(shift.date);
    if (!isSameMonth(dateObj, month)) continue;
    const existing = shiftIndex.get(shift.date);
    const byType: Partial<Record<ShiftType, Shift>> = existing ?? {};
    byType[shift.shiftType as ShiftType] = shift;
    shiftIndex.set(shift.date, byType);
  }

  const header = [
    "",
    "",
    "Nachtdienst",
    "20:00 Dienst",
    "15:00/17:00 Uhr Dienst",
    "Hintergrund",
  ];

  const rowsAoa = days.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const byType: Partial<Record<ShiftType, Shift>> =
      shiftIndex.get(key) ?? ({} as Partial<Record<ShiftType, Shift>>);
    const isWeekend = [0, 6].includes(day.getDay());

    const dayNumber = format(day, "d", { locale: de });
    const dayNameShort = format(day, "EEE", { locale: de }).replace(".", "");

    const row: string[] = [dayNumber, dayNameShort, "", "", "", ""];

    SHIFT_TYPES.forEach((type) => {
      const showDash = isWeekendOnly(type) && !isWeekend;
      const shift = byType[type];
      const value = showDash
        ? "-"
        : shift
          ? shift.doctors.length > 0
            ? shift.doctors.map((doctor) => doctor.name).join(", ")
            : "Unassigned"
          : "Unassigned";

      if (type === "20shift") row[3] = value;
      if (type === "17shift") row[4] = value;
    });

    return row;
  });

  const ExcelJS = (await import("exceljs")) as unknown as ExcelJSPackage;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Month", {
    properties: { defaultRowHeight: 18 },
    views: [{ state: "frozen", ySplit: 1 }],
  });

  worksheet.columns = [
    { width: 4 },
    { width: 6 },
    { width: 16 },
    { width: 16 },
    { width: 22 },
    { width: 16 },
  ];

  const applyBorder = (cell: ExcelCell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FFBFBFBF" } },
      left: { style: "thin", color: { argb: "FFBFBFBF" } },
      bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
      right: { style: "thin", color: { argb: "FFBFBFBF" } },
    };
  };

  const headerRow = worksheet.addRow(header);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    applyBorder(cell);
  });

  rowsAoa.forEach((rowVals, idx) => {
    const day = days[idx];
    const isWeekend = [0, 6].includes(day.getDay());
    const row = worksheet.addRow(rowVals);
    row.height = 18;
    row.eachCell((cell, colNumber: number) => {
      if (colNumber === 1 || colNumber === 2) {
        cell.alignment = { horizontal: "center" };
      }
      applyBorder(cell);
      if (isWeekend) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFEDEDED" },
        };
      }
    });
  });

  const lastRow = worksheet.lastRow?.number ?? 1;
  for (let r = 1; r <= lastRow; r++) {
    for (let c = 1; c <= header.length; c++) {
      const cell = worksheet.getCell(r, c);
      applyBorder(cell);
    }
  }

  const fileName = `Shifts-${format(month, "yyyy-MM")}.xlsx`;
  const buffer: ArrayBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
