"use client";

import { useEffect, useMemo, useRef } from "react";
import { Check, Search, Trash2 } from "lucide-react";
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
  onSearchTermChange: (value: string) => void;
  onToggleDoctor: (doctorId: string) => void;
};

export function DoctorPicker({
  open,
  doctors,
  searchTerm,
  selectedDoctorIds,
  onSearchTermChange,
  onToggleDoctor,
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
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Arzt suchen"
            className="pl-9"
          />
        </div>
        <div className="space-y-2">
          <div className="text-[10px] font-medium text-muted-foreground">
            Ausgewahlt
          </div>
          {selectedDoctors.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedDoctors.map((doctor) => (
                <button
                  key={doctor.id}
                  type="button"
                  onClick={() => onToggleDoctor(doctor.id)}
                  className="cursor-pointer rounded-full"
                >
                  <Pill
                    color={doctor.color}
                    className="inline-flex cursor-pointer items-center gap-1 text-xs"
                  >
                    <span>{doctor.name}</span>
                    <Trash2 className="size-3" />
                  </Pill>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Noch kein Arzt ausgewahlt.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="border-t" />
        <div className="text-[10px] font-medium text-muted-foreground">
          Verfugbare Arzte
        </div>
      </div>

      <div className="max-h-64 space-y-1 overflow-auto">
        {filteredDoctors.length === 0 ? (
          <div className="rounded-md px-3 py-2 text-sm text-muted-foreground">
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
                  "flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent",
                  isSelected && "bg-accent/70",
                )}
                onClick={() => onToggleDoctor(doctor.id)}
              >
                <Pill color={doctor.color} className="text-xs">
                  {doctor.name}
                </Pill>
                <span className="flex h-4 w-4 items-center justify-center rounded-sm border">
                  {isSelected ? <Check className="size-3" /> : null}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
