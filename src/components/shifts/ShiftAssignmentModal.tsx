"use client";

import React from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Doctor, Shift } from "@/lib/api";
import { SHIFT_LABELS, SHIFT_TYPES, type ShiftType } from "@/lib/shifts";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";
import { MultiSelect } from "@/components/ui/multiselect";

interface ShiftAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | undefined;
  doctors: Doctor[];
  getShiftForType: (shiftType: string) => Shift | undefined;
  onAssign: (shiftType: string, doctorIds: number[]) => Promise<void>;
  unavailableByDoctor?: Record<number, Set<string>>;
  focusShiftType?: ShiftType | null;
}

export function ShiftAssignmentModal({
  open,
  onOpenChange,
  date,
  doctors,
  getShiftForType,
  onAssign,
  unavailableByDoctor = {},
  focusShiftType = null,
}: ShiftAssignmentModalProps) {
  const [pendingAssignments, setPendingAssignments] = React.useState<
    Record<string, number[]>
  >({});

  const activeShiftTypes = React.useMemo(
    () => (focusShiftType ? [focusShiftType] : SHIFT_TYPES),
    [focusShiftType],
  );

  const isDoctorAllowed = React.useCallback(
    (doctor: Doctor, shiftType: ShiftType) =>
      shiftType === "oa" ? doctor.oa : !doctor.oa,
    [],
  );

  const dateKey = React.useMemo(
    () => (date ? format(date, "yyyy-MM-dd") : null),
    [date],
  );

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const initial: Record<string, number[]> = {};
    activeShiftTypes.forEach((shiftType) => {
      const shift = getShiftForType(shiftType);
      initial[shiftType] = Array.isArray(shift?.doctorIds)
        ? shift.doctorIds.filter((doctorId) => {
            const doctor = doctors.find((d) => d.id === doctorId);
            if (!doctor) return false;
            return isDoctorAllowed(doctor, shiftType);
          })
        : [];
    });
    setPendingAssignments(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    dateKey,
    doctors,
    getShiftForType,
    isDoctorAllowed,
    activeShiftTypes,
  ]);

  const updatePending = React.useCallback(
    (shiftType: ShiftType, doctorIds: number[]) => {
      setPendingAssignments((prev) => ({
        ...prev,
        [shiftType]: doctorIds,
      }));
    },
    [],
  );

  const hasDoctorConflict = React.useCallback(
    (doctorId: number, shiftType: ShiftType) => {
      if (!dateKey) return false;
      const dateConflict = unavailableByDoctor[doctorId]?.has(dateKey) ?? false;
      const doctor = doctors.find((d) => d.id === doctorId);
      const shiftTypeConflict =
        doctor?.unavailableShiftTypes &&
        Array.isArray(doctor.unavailableShiftTypes)
          ? doctor.unavailableShiftTypes.includes(shiftType)
          : false;

      const nightOverlapConflict =
        shiftType === "night" &&
        (["17shift", "20shift"] as ShiftType[]).some((type) =>
          (pendingAssignments[type] ?? []).includes(doctorId),
        );

      return dateConflict || shiftTypeConflict || nightOverlapConflict;
    },
    [dateKey, doctors, unavailableByDoctor, pendingAssignments],
  );

  const handleSelectionChange = React.useCallback(
    (shiftType: ShiftType, values: string[]) => {
      const uniqueIds = Array.from(
        new Set(
          values
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value)),
        ),
      );
      updatePending(shiftType, uniqueIds);
    },
    [updatePending],
  );

  const handleApply = async () => {
    if (!date) {
      onOpenChange(false);
      return;
    }

    try {
      for (const shiftType of activeShiftTypes) {
        const doctorIds = pendingAssignments[shiftType] ?? [];
        await onAssign(shiftType, doctorIds);
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to apply shift assignments", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Assign Shifts {date ? `- ${format(date, "MMM d, yyyy")}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {activeShiftTypes.map((t) => {
            const shift = getShiftForType(t);
            const selectedDoctorIds = pendingAssignments[t] ?? [];

            const options = doctors
              .filter((doctor) => !doctor.disabled)
              .filter((doctor) => isDoctorAllowed(doctor, t))
              .map((doctor) => {
                return {
                  value: doctor.id.toString(),
                  label: doctor.name,
                  color: doctor.color ?? undefined,
                  hasConflict: hasDoctorConflict(doctor.id, t),
                };
              });

            const allowedSelectedDoctorIds = selectedDoctorIds.filter(
              (doctorId) => {
                const doctor = doctors.find((d) => d.id === doctorId);
                if (!doctor) return false;
                return isDoctorAllowed(doctor, t);
              },
            );

            return (
              <div key={t} className="p-3 border rounded-lg space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="font-medium text-sm">{SHIFT_LABELS[t]}</h3>
                  <MultiSelect
                    options={options}
                    selected={allowedSelectedDoctorIds.map((id) =>
                      id.toString(),
                    )}
                    onChange={(values) => handleSelectionChange(t, values)}
                    placeholder="Select doctors..."
                    className="w-full sm:w-60"
                  />
                </div>
                {allowedSelectedDoctorIds.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {allowedSelectedDoctorIds.map((doctorId) => {
                      const assignedDoctor =
                        shift?.doctors.find((doc) => doc.id === doctorId) ??
                        doctors.find((doc) => doc.id === doctorId);
                      if (!assignedDoctor) return null;
                      return (
                        <Pill
                          key={`${assignedDoctor.id}-${t}`}
                          color={assignedDoctor.color || undefined}
                          showX={hasDoctorConflict(assignedDoctor.id, t)}
                          className={cn("text-xs")}
                        >
                          {assignedDoctor.name}
                        </Pill>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <Button
            onClick={handleApply}
            className="w-full border-2 border-green-200"
          >
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
