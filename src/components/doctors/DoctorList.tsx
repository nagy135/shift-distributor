"use client";

import { CalendarDays, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import type { Doctor, Shift } from "@/lib/api";
import { getDoctorShiftCount } from "@/components/doctors/utils";

type DoctorListProps = {
  doctors: Doctor[];
  shifts: Shift[];
  month: Date;
  onOpenShiftDetails: (doctor: Doctor) => void;
  onOpenUnavailable: (doctor: Doctor) => void;
  onOpenSettings: (doctor: Doctor) => void;
};

export function DoctorList({
  doctors,
  shifts,
  month,
  onOpenShiftDetails,
  onOpenUnavailable,
  onOpenSettings,
}: DoctorListProps) {
  return (
    <div className="grid gap-4">
      {[...doctors]
        .sort((a, b) => {
          if (a.disabled && !b.disabled) return 1;
          if (!a.disabled && b.disabled) return -1;
          return 0;
        })
        .map((doctor) => (
          <div
            key={doctor.id}
            className={`max-w-sm p-4 border rounded-lg ${doctor.disabled ? "opacity-60" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Pill
                    color={doctor.color || undefined}
                    className="cursor-pointer"
                    onClick={() => onOpenSettings(doctor)}
                  >
                    {doctor.name}
                  </Pill>
                  {doctor.disabled && (
                    <span className="text-sm bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded">
                      Disabled
                    </span>
                  )}
                  <span className="text-sm text-muted-foreground">
                    ({getDoctorShiftCount(doctor.id, shifts, month)})
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onOpenShiftDetails(doctor)}
                  className="sm:hidden"
                  aria-label="Shifts"
                  title="Shifts"
                >
                  <CalendarDays className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenShiftDetails(doctor)}
                  className="hidden sm:inline-flex"
                >
                  Shifts
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onOpenUnavailable(doctor)}
                  className="sm:hidden"
                  aria-label="Unavailable"
                  title="Unavailable"
                >
                  <CalendarOff className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenUnavailable(doctor)}
                  className="hidden sm:inline-flex"
                >
                  Unavailable
                </Button>
              </div>
            </div>
          </div>
        ))}

      {doctors.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No doctors added yet. Add your first doctor to get started.
        </div>
      )}
    </div>
  );
}
