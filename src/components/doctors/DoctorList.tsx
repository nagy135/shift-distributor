"use client";

import {
  CalendarDays,
  CalendarOff,
  ChevronRight,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Doctor, Shift } from "@/lib/api";
import {
  getDoctorShiftCount,
  matchesDoctorSearch,
} from "@/components/doctors/utils";

type DoctorListProps = {
  doctors: Doctor[];
  shifts: Shift[];
  month: Date;
  onOpenShiftDetails: (doctor: Doctor) => void;
  onOpenUnavailable: (doctor: Doctor) => void;
  onOpenSettings: (doctor: Doctor) => void;
  showSettings?: boolean;
  searchQuery?: string;
  emptyMessage?: string;
};

export function DoctorList({
  doctors,
  shifts,
  month,
  onOpenShiftDetails,
  onOpenUnavailable,
  onOpenSettings,
  showSettings = true,
  searchQuery = "",
  emptyMessage = "Keine Ärzte in dieser Auswahl.",
}: DoctorListProps) {
  const entries = doctors.map((doctor) => ({
    doctor,
    count: getDoctorShiftCount(doctor.id, shifts, month),
  }));
  const activeEntries = entries.filter(({ doctor }) => !doctor.disabled);
  const disabledEntries = entries.filter(({ doctor }) => doctor.disabled);
  const visibleActiveEntries = activeEntries.filter(({ doctor }) =>
    matchesDoctorSearch(doctor, searchQuery),
  );
  const visibleDisabledEntries = disabledEntries.filter(({ doctor }) =>
    matchesDoctorSearch(doctor, searchQuery),
  );
  // Keep the comparison scale stable while searching by name.
  const maximumCount = Math.max(1, ...entries.map(({ count }) => count));
  const isSearching = searchQuery.trim().length > 0;

  function renderRow({ doctor, count }: (typeof entries)[number]) {
    return (
      <li
        key={doctor.id}
        className="grid grid-cols-[minmax(0,1fr)_2.5rem_auto] items-center gap-2 border-b py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:gap-4"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: doctor.color || "#a3a3a3" }}
          />
          {showSettings ? (
            <button
              type="button"
              onClick={() => onOpenSettings(doctor)}
              title={`${doctor.name}: Einstellungen`}
              className={`min-w-0 cursor-pointer truncate rounded-sm text-left text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${doctor.disabled ? "text-muted-foreground" : ""}`}
            >
              {doctor.name}
            </button>
          ) : (
            <span className="truncate text-sm font-medium" title={doctor.name}>
              {doctor.name}
            </span>
          )}
        </div>
        <div
          className="flex flex-col-reverse items-stretch gap-1.5 sm:flex-row sm:items-center sm:gap-3"
          title={`${count} ${count === 1 ? "Dienst" : "Dienste"} im ausgewählten Monat`}
        >
          <div
            aria-hidden="true"
            className="h-1 overflow-hidden rounded-full bg-muted sm:flex-1"
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${(count / maximumCount) * 100}%`,
                backgroundColor: doctor.color || "#a3a3a3",
              }}
            />
          </div>
          <span className="min-w-7 rounded-md bg-muted px-1.5 py-1 text-center text-xs font-medium tabular-nums">
            {count}
            <span className="sr-only">
              {" "}
              {count === 1 ? "Dienst" : "Dienste"}
            </span>
          </span>
        </div>
        <div className="flex items-center justify-end gap-1 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenShiftDetails(doctor)}
            className="size-8 p-0 shadow-none sm:w-auto sm:px-3"
            aria-label={`Dienste von ${doctor.name}`}
            title="Dienste"
          >
            <CalendarDays aria-hidden="true" />
            <span className="hidden sm:inline">Dienste</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenUnavailable(doctor)}
            className="size-8 p-0 shadow-none sm:w-auto sm:px-3"
            aria-label={`Dienstwünsche von ${doctor.name}`}
            title="Dienstwünsche"
          >
            <CalendarOff aria-hidden="true" />
            <span className="hidden sm:inline">Dienstwünsche</span>
          </Button>
          {showSettings && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onOpenSettings(doctor)}
              aria-label={`Einstellungen für ${doctor.name}`}
              title="Einstellungen"
            >
              <Settings2 aria-hidden="true" />
            </Button>
          )}
        </div>
      </li>
    );
  }

  return (
    <section
      aria-label="Dienstübersicht der Ärzte"
      className="rounded-xl border bg-card p-3 sm:p-4"
    >
      <div className="flex items-center justify-between gap-3 pb-3">
        <h2 className="text-sm font-semibold">Ärzte</h2>
        <p role="status" className="text-xs text-muted-foreground tabular-nums">
          {isSearching
            ? `${visibleActiveEntries.length} von ${activeEntries.length} aktiven Ärzten`
            : `${activeEntries.length} ${activeEntries.length === 1 ? "aktiver Arzt" : "aktive Ärzte"}`}
        </p>
      </div>
      {visibleActiveEntries.length > 0 ? (
        <ul className="border-t">{visibleActiveEntries.map(renderRow)}</ul>
      ) : (
        <p className="border-t py-8 text-center text-sm text-muted-foreground">
          {isSearching
            ? "Keine aktiven Ärzte gefunden. Passen Sie die Suche an."
            : activeEntries.length === 0 && disabledEntries.length > 0
              ? "Keine aktiven Ärzte in dieser Auswahl."
              : emptyMessage}
        </p>
      )}
      {disabledEntries.length > 0 && (
        <details className="group mt-3 border-t pt-3">
          <summary className="flex min-h-8 cursor-pointer list-none flex-wrap items-center gap-2 rounded-sm text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden="true"
              className="size-4 group-open:rotate-90"
            />
            Deaktivierte Ärzte
            <span className="rounded-md bg-muted px-1.5 py-1 tabular-nums">
              {disabledEntries.length}
            </span>
            {isSearching && (
              <span>({visibleDisabledEntries.length} Treffer)</span>
            )}
          </summary>
          {visibleDisabledEntries.length > 0 ? (
            <ul className="mt-2">{visibleDisabledEntries.map(renderRow)}</ul>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">
              Keine deaktivierten Ärzte mit diesem Namen gefunden.
            </p>
          )}
        </details>
      )}
    </section>
  );
}
