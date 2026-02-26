"use client";

import { format, isSameMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { useMonthStore } from "@/lib/month-store";
import type { ReactNode } from "react";

type Props = {
  rightActions?: ReactNode;
};

export function MonthSelector({ rightActions }: Props) {
  const { month, prevMonth, nextMonth, setMonth } = useMonthStore();
  const isTodayMonth = isSameMonth(month, new Date());

  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-2">
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={prevMonth}>
          {"<"}
        </Button>
        <div className="text-sm font-medium w-30 text-center">
          {format(month, "MMMM yyyy")}
        </div>
        <Button variant="outline" onClick={nextMonth}>
          {">"}
        </Button>
        <Button
          disabled={isTodayMonth}
          variant={isTodayMonth ? "secondary" : "outline"}
          onClick={() => setMonth(new Date())}
        >
          Today
        </Button>
      </div>
      <div className="flex items-center gap-2 lg:ml-auto">{rightActions}</div>
    </div>
  );
}
