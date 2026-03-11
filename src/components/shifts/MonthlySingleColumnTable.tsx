"use client";

import React from "react";
import type { CalendarShiftColumn } from "@/lib/shifts";
import { cn } from "@/lib/utils";
import { MonthlyTableBase } from "@/components/shifts/MonthlyTableBase";

export type MonthlySingleColumnValue = {
  text: string;
  title?: string;
  className?: string;
  content?: React.ReactNode;
};

type MonthlySingleColumnTableProps = {
  month: Date;
  column: CalendarShiftColumn;
  valuesByDate: ReadonlyMap<string, MonthlySingleColumnValue>;
  selectedDateKey?: string | null;
  onCellClick?: (date: Date) => void;
  wrapperRef?: React.Ref<HTMLDivElement>;
  containerRef?: React.Ref<HTMLDivElement>;
  cellRefs?: React.MutableRefObject<Map<string, HTMLTableCellElement>>;
  containerClassName?: string;
  children?: React.ReactNode;
};

export function MonthlySingleColumnTable({
  month,
  column,
  valuesByDate,
  selectedDateKey,
  onCellClick,
  wrapperRef,
  containerRef,
  cellRefs,
  containerClassName,
  children,
}: MonthlySingleColumnTableProps) {
  const isInteractive = typeof onCellClick === "function";

  return (
    <MonthlyTableBase
      month={month}
      wrapperRef={wrapperRef}
      containerRef={containerRef}
      containerClassName={containerClassName}
      headerCells={
        <th className="min-w-[180px] border-l border-gray-400 px-2 py-1 text-center">
          <span className="flex flex-col items-center leading-tight">
            <span>{column.label}</span>
            {column.headerNote ? (
              <span className="text-[10px] font-normal text-muted-foreground">
                {column.headerNote}
              </span>
            ) : null}
          </span>
        </th>
      }
      getDateCellProps={() => ({
        className: isInteractive ? "hover:bg-muted/30" : undefined,
      })}
      renderCells={({ date, dateKey }) => {
        const value = valuesByDate.get(dateKey);
        const isSelected = selectedDateKey === dateKey;

        return (
          <td
            ref={(node) => {
              if (!cellRefs) {
                return;
              }

              if (node) {
                cellRefs.current.set(dateKey, node);
              } else {
                cellRefs.current.delete(dateKey);
              }
            }}
            title={value?.title}
            className={cn(
              "min-w-[180px] border-l border-gray-400 px-2 py-1 text-center",
              isInteractive && "cursor-pointer hover:bg-muted/30",
              isSelected &&
                "outline-2 outline-offset-[-2px] outline-solid outline-sky-500 bg-sky-100 dark:bg-sky-950/60",
              value?.className,
            )}
            onClick={(event) => {
              if (!isInteractive) {
                return;
              }

              event.stopPropagation();
              onCellClick(date);
            }}
          >
            {value?.content ?? (value?.text?.trim() ? value.text : "-")}
          </td>
        );
      }}
    >
      {children}
    </MonthlyTableBase>
  );
}
