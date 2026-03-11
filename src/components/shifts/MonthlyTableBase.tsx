"use client";

import React from "react";
import { eachDayOfInterval, endOfMonth, format, startOfMonth } from "date-fns";
import { de } from "date-fns/locale";
import { HOLIDAY_DATE_SET_2026 } from "@/lib/holidays";
import { cn } from "@/lib/utils";

export type MonthlyTableRowContext = {
  date: Date;
  dateKey: string;
  rowIndex: number;
  dayPrefix: string;
  isHoliday: boolean;
  isWeekend: boolean;
};

type MonthlyTableBaseProps = {
  month: Date;
  headerCells: React.ReactNode;
  renderCells: (context: MonthlyTableRowContext) => React.ReactNode;
  getRowProps?: (
    context: MonthlyTableRowContext,
  ) => React.HTMLAttributes<HTMLTableRowElement>;
  getDateCellProps?: (
    context: MonthlyTableRowContext,
  ) => React.TdHTMLAttributes<HTMLTableCellElement>;
  renderDateCellContent?: (context: MonthlyTableRowContext) => React.ReactNode;
  wrapperRef?: React.Ref<HTMLDivElement>;
  containerRef?: React.Ref<HTMLDivElement>;
  containerClassName?: string;
  tableClassName?: string;
  containerProps?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;
};

export function getMonthTableDays(month: Date): Date[] {
  return eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });
}

function DefaultDateCellContent({
  date,
  dayPrefix,
  isHoliday,
}: MonthlyTableRowContext) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span>{format(date, "d.", { locale: de })}</span>
      <span>{isHoliday ? <span className="text-red-600">{dayPrefix}</span> : dayPrefix}</span>
    </span>
  );
}

export function MonthlyTableBase({
  month,
  headerCells,
  renderCells,
  getRowProps,
  getDateCellProps,
  renderDateCellContent,
  wrapperRef,
  containerRef,
  containerClassName,
  tableClassName,
  containerProps,
  children,
}: MonthlyTableBaseProps) {
  const days = React.useMemo(() => getMonthTableDays(month), [month]);
  const {
    className: containerPropsClassName,
    ...restContainerProps
  } = containerProps ?? {};

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div
        ref={containerRef}
        className={cn(
          "max-w-full overflow-auto rounded-md border select-none",
          containerClassName,
          containerPropsClassName,
        )}
        {...restContainerProps}
      >
        <table className={cn("w-max min-w-full text-sm", tableClassName)}>
          <thead className="border-b border-gray-400 bg-muted/50">
            <tr>
              <th
                className="w-[50px] border-r border-gray-400 px-1 py-1 text-left"
                aria-label="Datum"
              />
              {headerCells}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-400">
            {days.map((date, rowIndex) => {
              const dateKey = format(date, "yyyy-MM-dd");
              const isHoliday = HOLIDAY_DATE_SET_2026.has(dateKey);
              const dayName = format(date, "EEEE", { locale: de });
              const dayPrefix = dayName.slice(0, 2);
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const context = {
                date,
                dateKey,
                rowIndex,
                dayPrefix,
                isHoliday,
                isWeekend,
              } satisfies MonthlyTableRowContext;
              const rowProps = getRowProps?.(context) ?? {};
              const { className: rowClassName, ...restRowProps } = rowProps;
              const dateCellProps = getDateCellProps?.(context) ?? {};
              const {
                className: dateCellClassName,
                ...restDateCellProps
              } = dateCellProps;

              return (
                <tr
                  key={dateKey}
                  className={cn(
                    (isWeekend || isHoliday) && "bg-gray-200 dark:bg-gray-700",
                    rowClassName,
                  )}
                  {...restRowProps}
                >
                  <td
                    className={cn(
                      "min-w-[50px] border-r border-gray-400 px-1 py-1 text-xs",
                      dateCellClassName,
                    )}
                    {...restDateCellProps}
                  >
                    {renderDateCellContent ? (
                      renderDateCellContent(context)
                    ) : (
                      <DefaultDateCellContent {...context} />
                    )}
                  </td>
                  {renderCells(context)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {children}
    </div>
  );
}
