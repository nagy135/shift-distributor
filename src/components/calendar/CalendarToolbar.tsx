"use client";

import type { CalendarTableView } from "@/components/calendar/CalendarContent";
import { Button } from "@/components/ui/button";
import { useMonthStore } from "@/lib/month-store";
import { format, isSameMonth } from "date-fns";
import { de } from "date-fns/locale";
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { ReactNode } from "react";

type CalendarToolbarProps = {
  tableView: CalendarTableView;
  onTableViewChange: (view: CalendarTableView) => void;
  showViewSwitch: boolean;
  actions: ReactNode;
};

export function CalendarToolbar({
  tableView,
  onTableViewChange,
  showViewSwitch,
  actions,
}: CalendarToolbarProps) {
  const { month, prevMonth, nextMonth, setMonth } = useMonthStore();
  const isCurrentMonth = isSameMonth(month, new Date());

  return (
    <section
      aria-label="Kalendersteuerung"
      className="space-y-2.5 rounded-xl border bg-card p-3 sm:space-y-3 sm:p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:flex-none sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 min-[360px]:size-8"
            onClick={prevMonth}
            aria-label="Vorheriger Monat"
            title="Vorheriger Monat"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <h2 className="min-w-0 flex-1 whitespace-nowrap text-center text-sm font-semibold min-[360px]:text-base sm:min-w-40 sm:text-lg">
            {format(month, "MMMM yyyy", { locale: de })}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 min-[360px]:size-8"
            onClick={nextMonth}
            aria-label="Nächster Monat"
            title="Nächster Monat"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="px-2 shadow-none sm:px-3"
          disabled={isCurrentMonth}
          onClick={() => setMonth(new Date())}
        >
          Heute
        </Button>
      </div>

      <div className="flex flex-col gap-2.5 border-t pt-2.5 sm:gap-3 sm:pt-3 xl:flex-row xl:items-center xl:justify-between">
        {showViewSwitch && (
          <div
            role="group"
            aria-label="Kalenderansicht"
            className="flex shrink-0 gap-1 rounded-lg bg-muted/60 p-1 sm:w-fit"
          >
            <Button
              type="button"
              size="sm"
              variant={tableView === "shifts" ? "default" : "ghost"}
              className="flex-1 sm:flex-none"
              aria-pressed={tableView === "shifts"}
              onClick={() => onTableViewChange("shifts")}
            >
              <CalendarDays aria-hidden="true" />
              Dienste
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tableView === "departments" ? "default" : "ghost"}
              className="flex-1 sm:flex-none"
              aria-pressed={tableView === "departments"}
              onClick={() => onTableViewChange("departments")}
            >
              <Building2 aria-hidden="true" />
              Station
            </Button>
          </div>
        )}
        <div
          role="group"
          aria-label="Kalenderaktionen"
          className="grid auto-cols-fr grid-flow-col gap-1.5 sm:flex sm:flex-wrap sm:gap-2"
        >
          {actions}
        </div>
      </div>
    </section>
  );
}
