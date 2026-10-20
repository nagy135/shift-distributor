"use client";

import { format, isSameMonth } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMonthStore } from "@/lib/month-store";
import type { ReactNode } from "react";

type Props = {
  ariaLabel: string;
  children?: ReactNode;
};

export function MonthSelector({ ariaLabel, children }: Props) {
  const { month, prevMonth, nextMonth, setMonth } = useMonthStore();
  const isCurrentMonth = isSameMonth(month, new Date());

  return (
    <section
      aria-label={ariaLabel}
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
      {children && (
        <div className="border-t pt-2.5 sm:pt-3">{children}</div>
      )}
    </section>
  );
}
