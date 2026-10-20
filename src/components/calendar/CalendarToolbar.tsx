"use client";

import type { CalendarTableView } from "@/components/calendar/CalendarContent";
import { Button } from "@/components/ui/button";
import { MonthSelector } from "@/components/MonthSelector";
import { Building2, CalendarDays } from "lucide-react";
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
  return (
    <MonthSelector ariaLabel="Kalendersteuerung">
      <div className="flex flex-col gap-2.5 sm:gap-3 xl:flex-row xl:items-center xl:justify-between">
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
    </MonthSelector>
  );
}
