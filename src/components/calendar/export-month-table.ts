import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
} from "date-fns";
import { de } from "date-fns/locale";
import { HOLIDAY_DAY_SET } from "@/lib/holidays";
import {
  DEPARTMENT_SHIFT_COLUMNS,
  SHIFT_TABLE_COLUMNS,
} from "@/lib/shifts";
import type { Shift } from "@/lib/api";
import {
  getAutomaticNightShiftVacationDays,
  getDoctorNamesByDate,
  NIGHT_FREE_COLUMN_ID,
} from "@/lib/night-shift-vacations";

type ExportMonthTableParams = {
  month: Date;
  allShifts: Shift[];
  tableView?: "shifts" | "departments";
  vacationColumnByDate?: Record<string, string[]>;
};

type BorderLineStyle = "thin" | "medium";
type BorderStyle = { style: BorderLineStyle; color: { argb: string } };
type BorderSide = "top" | "left" | "bottom" | "right";
type ExcelCell = {
  border?: {
    top: BorderStyle;
    left: BorderStyle;
    bottom: BorderStyle;
    right: BorderStyle;
  };
  alignment?: { vertical?: string; horizontal?: string };
  font?: { bold?: boolean; size?: number };
  fill?: { type: "pattern"; pattern: "solid"; fgColor: { argb: string } };
};
type ExcelRow = {
  height?: number;
  eachCell: (callback: (cell: ExcelCell, colNumber: number) => void) => void;
};
type ExcelWorksheet = {
  columns: { width: number }[];
  views?: Array<{ state?: string; ySplit?: number }>;
  addRow: (values: Array<string | number | null | undefined>) => ExcelRow;
  getCell: (row: number, col: number) => ExcelCell;
  mergeCells: (
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
  ) => void;
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

const EXCEL_FONT = '11pt Aptos, Calibri, "Helvetica Neue", Arial, sans-serif';
const EXCEL_WIDTH_PADDING = 10;

function isExportCellEditable(
  day: Date,
  columnId: string,
  isDepartmentTable: boolean,
) {
  if (columnId === NIGHT_FREE_COLUMN_ID) {
    return false;
  }

  if (!isDepartmentTable || columnId === "night") {
    return true;
  }

  const dayKey = format(day, "MM-dd");
  const isWeekend = [0, 6].includes(day.getDay());

  return !isWeekend && !HOLIDAY_DAY_SET.has(dayKey);
}

function getEmptyExportCellLabel(isEditable: boolean) {
  return isEditable ? "-" : "";
}

function createTextWidthMeasurer() {
  if (typeof document === "undefined") {
    return (value: string) => value.length * 7;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return (value: string) => value.length * 7;
  }

  context.font = EXCEL_FONT;
  return (value: string) => context.measureText(value).width;
}

function getExcelColumnWidth(
  measureTextWidth: (value: string) => number,
  values: Array<string | number | null | undefined>,
  minWidth = 4,
) {
  const widestText = values.reduce<number>((maxWidth, value) => {
    const normalized = value == null ? "" : String(value);
    return Math.max(maxWidth, measureTextWidth(normalized));
  }, 0);

  return Math.max(
    minWidth,
    Math.min(60, Math.ceil((widestText + EXCEL_WIDTH_PADDING) / 7)),
  );
}

export async function exportMonthTable({
  month,
  allShifts,
  tableView = "shifts",
  vacationColumnByDate = {},
}: ExportMonthTableParams) {
  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });

  const shiftIndex = new Map<string, Partial<Record<string, Shift>>>();
  for (const shift of allShifts) {
    const dateObj = new Date(shift.date);
    if (!isSameMonth(dateObj, month)) continue;
    const existing = shiftIndex.get(shift.date);
    const byType: Partial<Record<string, Shift>> = existing ?? {};
    byType[shift.shiftType] = shift;
    shiftIndex.set(shift.date, byType);
  }

  const isDepartmentTable = tableView === "departments";
  const automaticNightVacationsByDate = isDepartmentTable
    ? getDoctorNamesByDate(getAutomaticNightShiftVacationDays(allShifts))
    : {};
  const tableColumns = isDepartmentTable
    ? DEPARTMENT_SHIFT_COLUMNS
    : SHIFT_TABLE_COLUMNS;
  const exportSpacerIndex = isDepartmentTable
    ? tableColumns.findIndex((column) => column.id === "night")
    : -1;
  const header = [
    "",
    "",
    ...tableColumns.flatMap((column, columnIndex) => {
      const label = (() => {
        if (!isDepartmentTable && column.id === "oa") return "Hintergrund";
        if (!isDepartmentTable && column.id === "20shift") {
          return "20:00 Dienst";
        }
        return column.slotLabel ?? column.label;
      })();

      return columnIndex === exportSpacerIndex ? ["", label] : [label];
    }),
    ...(isDepartmentTable ? ["Urlaub"] : []),
  ];
  const subheader = [
    "",
    "",
    ...tableColumns.flatMap((column, columnIndex) => {
      const note = column.headerNote ?? "";

      return columnIndex === exportSpacerIndex ? ["", note] : [note];
    }),
    ...(isDepartmentTable ? [""] : []),
  ];
  const title = isDepartmentTable
    ? `Stationverteilung ${format(month, "MMMM yyyy", { locale: de })}`
    : "Ärztlicher Dienstplan Medizinische Klinik KKH Schlüchtern";
  const monthLabel = format(month, "yyyy MMMM", { locale: de });

  const rowsAoa = days.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const byType: Partial<Record<string, Shift>> =
      shiftIndex.get(key) ?? ({} as Partial<Record<string, Shift>>);
    const dayNumber = format(day, "d", { locale: de });
    const dayNameShort = format(day, "EEE", { locale: de }).replace(".", "");

    const row: string[] = [
      dayNumber,
      dayNameShort,
      ...tableColumns.flatMap((column, columnIndex) => {
        const isEditableCell = isExportCellEditable(day, column.id, isDepartmentTable);
        const value = (() => {
          if (column.id === NIGHT_FREE_COLUMN_ID) {
            return automaticNightVacationsByDate[key]?.join(", ") ?? "";
          }

          const type = column.id;
          const shift = byType[type];
          return shift
            ? shift.doctors.length > 0
              ? shift.doctors.map((doctor: { name: string }) => doctor.name).join(", ")
              : getEmptyExportCellLabel(isEditableCell)
            : getEmptyExportCellLabel(isEditableCell);
        })();

        return columnIndex === exportSpacerIndex ? ["", value] : [value];
      }),
      ...(isDepartmentTable
        ? [vacationColumnByDate[key]?.join(", ") ?? ""]
        : []),
    ];

    return row;
  });

  const measureTextWidth = createTextWidthMeasurer();
  const minimumContentColumnWidth = getExcelColumnWidth(measureTextWidth, [
    "Ballouard",
  ]);
  const exportSpacerHeaderIndex = exportSpacerIndex >= 0 ? exportSpacerIndex + 2 : -1;
  const columnWidths = header.map((headerValue, columnIndex) => ({
    width: getExcelColumnWidth(measureTextWidth, [
      headerValue,
      ...rowsAoa.map((row) => row[columnIndex]),
    ], columnIndex >= 2 ? minimumContentColumnWidth : 4),
  }));

  if (exportSpacerHeaderIndex >= 0) {
    columnWidths[exportSpacerHeaderIndex] = { width: 8 };
  }

  const ExcelJS = (await import("exceljs")) as unknown as ExcelJSPackage;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Monat", {
    properties: { defaultRowHeight: 18 },
  });

  worksheet.columns = columnWidths;

  const gridBorder: BorderStyle = {
    style: "thin",
    color: { argb: "FFBFBFBF" },
  };
  const outlineBorder: BorderStyle = {
    style: "medium",
    color: { argb: "FF4A4A4A" },
  };

  const applyBorder = (
    cell: ExcelCell,
    overrides: Partial<Record<BorderSide, BorderStyle>> = {},
  ) => {
    cell.border = {
      top: overrides.top ?? gridBorder,
      left: overrides.left ?? gridBorder,
      bottom: overrides.bottom ?? gridBorder,
      right: overrides.right ?? gridBorder,
    };
  };

  worksheet.addRow([title]);
  const titleRowNumber = worksheet.lastRow?.number ?? 1;
  let monthRowNumber = titleRowNumber;

  if (!isDepartmentTable) {
    worksheet.addRow([]);
    worksheet.addRow([monthLabel]);
    monthRowNumber = worksheet.lastRow?.number ?? titleRowNumber + 2;
    worksheet.addRow([]);
  }

  const headerRow = worksheet.addRow(header);
  const headerRowNumber = worksheet.lastRow?.number ?? 1;
  const subheaderRow = worksheet.addRow(subheader);
  const subheaderRowNumber = worksheet.lastRow?.number ?? headerRowNumber + 1;
  if (header.length > 0) {
    worksheet.mergeCells(titleRowNumber, 1, titleRowNumber, header.length);
  }
  if (!isDepartmentTable && header.length > 0) {
    worksheet.mergeCells(monthRowNumber, 1, monthRowNumber, header.length);
  }

  const titleCell = worksheet.getCell(titleRowNumber, 1);
  titleCell.font = { bold: true };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };

  if (!isDepartmentTable) {
    const monthCell = worksheet.getCell(monthRowNumber, 1);
    monthCell.font = { bold: true };
    monthCell.alignment = { vertical: "middle", horizontal: "center" };
  }

  worksheet.views = [{ state: "frozen", ySplit: subheaderRowNumber }];
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    applyBorder(cell);
  });
  subheaderRow.eachCell((cell) => {
    cell.font = { bold: false, size: 9 };
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

  if (!isDepartmentTable) {
    const footerRow = (left: string, right: string) => {
      if (header.length <= 1) return [left];
      return [left, ...Array(header.length - 2).fill(""), right];
    };

    worksheet.addRow([]);
    worksheet.addRow(footerRow("AVD (tags und nachts)", "tel. 2228"));
    worksheet.addRow([]);
    worksheet.addRow(
      footerRow(
        "Dienstarzt für Stationen (Samstags bis 17:00h; Sonntags bis 15:00h)",
        "tel 2329",
      ),
    );
  }

  const tableStartRow = headerRowNumber;
  const tableEndRow = subheaderRowNumber + rowsAoa.length;
  for (let r = tableStartRow; r <= tableEndRow; r++) {
    for (let c = 1; c <= header.length; c++) {
      const cell = worksheet.getCell(r, c);
      applyBorder(cell, {
        top: r === tableStartRow ? outlineBorder : undefined,
        bottom: r === tableEndRow ? outlineBorder : undefined,
        left: c === 1 ? outlineBorder : undefined,
        right: c === header.length ? outlineBorder : undefined,
      });
    }
  }

  const fileName = `${isDepartmentTable ? "Stationsplan" : "Dienstplan"}-${format(month, "yyyy-MM")}.xlsx`;
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
