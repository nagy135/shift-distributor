"use client";

import { useEffect, useMemo, useRef } from "react";
import { Check, Search, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";

export type DoctorPickerOption = {
  id: string;
  name: string;
  color: string;
};

type DoctorPickerProps = {
  open: boolean;
  doctors: DoctorPickerOption[];
  searchTerm: string;
  selectedDoctorIds: readonly string[];
  selectionMarkerClassName?: string;
  onSearchTermChange: (value: string) => void;
  onToggleDoctor: (doctorId: string) => void;
  onClose?: () => void;
};

export function DoctorPicker({
  open,
  doctors,
  searchTerm,
  selectedDoctorIds,
  selectionMarkerClassName,
  onSearchTermChange,
  onToggleDoctor,
  onClose,
}: DoctorPickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const selectedIdSet = useMemo(
    () => new Set(selectedDoctorIds),
    [selectedDoctorIds],
  );

  const filteredDoctors = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    return doctors.filter((doctor) =>
      normalizedTerm.length === 0
        ? true
        : doctor.name.toLowerCase().includes(normalizedTerm),
    );
  }, [doctors, searchTerm]);

  const selectedDoctors = useMemo(
    () =>
      selectedDoctorIds
        .map((doctorId) => doctors.find((entry) => entry.id === doctorId))
        .filter((doctor): doctor is DoctorPickerOption => doctor != null),
    [doctors, selectedDoctorIds],
  );

  return (
    <div>
      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Arzt suchen..."
            className="pl-9"
          />
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {/* Selected doctors chips */}
      {selectedDoctors.length > 0 ? (
        <div className="mt-3 border-b-2 border-border bg-muted/50 rounded-md px-2.5 py-2.5 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.1)]">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Zugewiesen ({selectedDoctors.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {selectedDoctors.map((doctor) => (
              <button
                key={doctor.id}
                type="button"
                onClick={() => onToggleDoctor(doctor.id)}
                className="group inline-flex cursor-pointer items-center gap-1 rounded-full border border-border/50 bg-muted/40 py-0.5 pl-1 pr-1.5 text-xs transition-colors hover:border-red-300 hover:bg-red-50 dark:hover:border-red-800 dark:hover:bg-red-950/40"
              >
                <Pill
                  color={doctor.color}
                  className="inline-flex items-center gap-1 text-xs"
                >
                  {selectionMarkerClassName ? (
                    <span
                      className={cn(
                        "h-2.5 w-2.5 shrink-0 rounded-full border border-background/60",
                        selectionMarkerClassName,
                      )}
                    />
                  ) : null}
                  <span>{doctor.name}</span>
                </Pill>
                <Trash2 className="size-3 text-muted-foreground group-hover:text-red-500" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Options list */}
      <div className="mt-3 max-h-56 overflow-auto">
        {filteredDoctors.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            Keine passenden Arzte gefunden.
          </div>
        ) : (
          filteredDoctors.map((doctor) => {
            const isSelected = selectedIdSet.has(doctor.id);

            return (
              <button
                key={doctor.id}
                type="button"
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                  isSelected && "bg-sky-50/60 dark:bg-sky-950/20",
                )}
                onClick={() => onToggleDoctor(doctor.id)}
              >
                <div
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                    isSelected
                      ? "border-foreground bg-foreground text-background"
                      : "border-border",
                  )}
                >
                  {isSelected ? <Check className="size-3" /> : null}
                </div>
                <Pill color={doctor.color} className="inline-flex items-center gap-1 text-xs">
                  {selectionMarkerClassName ? (
                    <span
                      className={cn(
                        "h-2.5 w-2.5 shrink-0 rounded-full border border-background/60",
                        selectionMarkerClassName,
                      )}
                    />
                  ) : null}
                  {doctor.name}
                </Pill>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
