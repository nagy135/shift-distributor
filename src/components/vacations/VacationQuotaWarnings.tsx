"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatVacationQuotaIssue,
  type VacationQuotaIssue,
} from "@/lib/vacations";
import { AlertTriangle, ChevronDown } from "lucide-react";

type VacationQuotaWarningsProps = {
  year: number;
  doctors: { id: string; name: string; issues: VacationQuotaIssue[] }[];
  onSelectDoctor: (id: string) => void;
};

export function VacationQuotaWarnings({
  year,
  doctors,
  onSelectDoctor,
}: VacationQuotaWarningsProps) {
  if (doctors.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="ml-auto w-full border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-900 sm:w-auto dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950 dark:hover:text-amber-200"
        >
          <AlertTriangle aria-hidden="true" className="size-4" />
          Kontingente überschritten ({doctors.length})
          <ChevronDown aria-hidden="true" className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label={`Überschrittene Urlaubskontingente ${year}`}
        className="max-h-[min(28rem,var(--radix-popover-content-available-height))] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto"
      >
        <h3 className="text-sm font-semibold">Urlaubskontingente {year}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Diese Auswahl überschreitet das Jahreskontingent und wird trotzdem
          gespeichert. Genehmigte und offene Anträge zählen mit.
        </p>
        <ul className="mt-3 space-y-3">
          {doctors.map((doctor) => (
            <li key={doctor.id} className="rounded-md border p-3">
              <PopoverClose asChild>
                <button
                  type="button"
                  className="cursor-pointer text-left text-sm font-medium underline-offset-4 hover:underline focus-visible:underline"
                  onClick={() => onSelectDoctor(doctor.id)}
                  aria-label={`Urlaub von ${doctor.name} anzeigen`}
                >
                  {doctor.name}
                </button>
              </PopoverClose>
              <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                {doctor.issues.map((issue) => (
                  <li key={issue.color}>{formatVacationQuotaIssue(issue)}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
