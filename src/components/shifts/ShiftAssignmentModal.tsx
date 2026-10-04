"use client";

import {
  getShiftTargetKey,
  type CalendarShiftTarget,
} from "@/components/calendar/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MultiSelect } from "@/components/ui/multiselect";
import { Pill } from "@/components/ui/pill";
import { Switch } from "@/components/ui/switch";
import type { Doctor, Shift } from "@/lib/api";
import {
  getAssignmentConflicts,
  isDoctorEligible,
} from "@/lib/scheduling-rules";
import {
  ALL_CALENDAR_SHIFT_TYPES,
  SHIFT_TYPES,
  getShiftLabel,
} from "@/lib/shifts";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import React from "react";

type ShiftAssignment = CalendarShiftTarget & {
  doctorIds: number[];
};

interface ShiftAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | undefined;
  targets?: CalendarShiftTarget[];
  doctors: Doctor[];
  getShift: (date: Date, shiftType: string) => Shift | undefined;
  onAssign: (assignments: ShiftAssignment[]) => Promise<void>;
  shiftTypes?: readonly string[];
  unavailableByDoctor?: Record<number, Set<string>>;
  vacationDoctorIdsByDate?: Record<string, number[]>;
  focusShiftType?: string | null;
}

const areDoctorListsEqual = (left: number[], right: number[]) =>
  left.length === right.length &&
  left.every((doctorId, index) => doctorId === right[index]);

export function ShiftAssignmentModal({
  open,
  onOpenChange,
  date,
  targets = [],
  doctors,
  getShift,
  onAssign,
  shiftTypes = SHIFT_TYPES,
  unavailableByDoctor = {},
  vacationDoctorIdsByDate = {},
  focusShiftType = null,
}: ShiftAssignmentModalProps) {
  const [pendingAssignments, setPendingAssignments] = React.useState<
    Record<string, number[]>
  >({});
  const saving = React.useRef(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [showOaDoctors, setShowOaDoctors] = React.useState(false);

  const assignmentTargets = React.useMemo(() => {
    if (targets.length > 0) {
      return targets;
    }

    if (!date) {
      return [];
    }

    const activeTypes = focusShiftType ? [focusShiftType] : [...shiftTypes];
    return activeTypes.map((shiftType) => ({ date, shiftType }));
  }, [date, focusShiftType, shiftTypes, targets]);

  const shiftTargetsMap = React.useMemo(() => {
    const map = new Map<string, CalendarShiftTarget[]>();

    assignmentTargets.forEach((target) => {
      const existingTargets = map.get(target.shiftType) ?? [];
      existingTargets.push(target);
      map.set(target.shiftType, existingTargets);
    });

    return map;
  }, [assignmentTargets]);

  const activeShiftTypes = React.useMemo(() => {
    return Array.from(shiftTargetsMap.keys());
  }, [shiftTargetsMap]);

  const selectedTargetKeys = React.useMemo(
    () => new Set(assignmentTargets.map((target) => getShiftTargetKey(target))),
    [assignmentTargets],
  );

  const isBatchMode = targets.length > 0;
  const canShowOaDoctors = React.useMemo(
    () => activeShiftTypes.some((shiftType) => shiftType !== "oa"),
    [activeShiftTypes],
  );

  const isDoctorAllowed = React.useCallback(
    (doctor: Doctor, shiftType: string) => {
      return isDoctorEligible(doctor, shiftType, showOaDoctors);
    },
    [showOaDoctors],
  );

  const getCurrentDoctorIds = React.useCallback(
    (target: CalendarShiftTarget) => {
      const shift = getShift(target.date, target.shiftType);
      return Array.isArray(shift?.doctorIds)
        ? shift.doctorIds.filter((doctorId) =>
            doctors.some((entry) => entry.id === doctorId),
          )
        : [];
    },
    [doctors, getShift],
  );

  React.useEffect(() => {
    if (open) {
      setShowOaDoctors(false);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const initial: Record<string, number[]> = {};

    activeShiftTypes.forEach((shiftType) => {
      const targetsForType = shiftTargetsMap.get(shiftType) ?? [];
      const currentDoctorLists = targetsForType.map(getCurrentDoctorIds);
      const firstDoctorList = currentDoctorLists[0] ?? [];

      initial[shiftType] = currentDoctorLists.every((doctorIds) =>
        areDoctorListsEqual(doctorIds, firstDoctorList),
      )
        ? firstDoctorList
        : [];
    });

    setPendingAssignments(initial);
  }, [activeShiftTypes, getCurrentDoctorIds, open, shiftTargetsMap]);

  const updatePending = React.useCallback(
    (shiftType: string, doctorIds: number[]) => {
      setPendingAssignments((previousAssignments) => ({
        ...previousAssignments,
        [shiftType]: doctorIds,
      }));
    },
    [],
  );

  const isDoctorAssignedToDateShift = React.useCallback(
    (doctorId: number, target: CalendarShiftTarget) => {
      if (selectedTargetKeys.has(getShiftTargetKey(target))) {
        return (pendingAssignments[target.shiftType] ?? []).includes(doctorId);
      }

      const shift = getShift(target.date, target.shiftType);
      return Array.isArray(shift?.doctorIds)
        ? shift.doctorIds.includes(doctorId)
        : false;
    },
    [getShift, pendingAssignments, selectedTargetKeys],
  );

  const hasDoctorConflict = React.useCallback(
    (doctorId: number, shiftType: string) => {
      const targetsForType = shiftTargetsMap.get(shiftType) ?? [];

      const doctor = doctors.find((entry) => entry.id === doctorId);
      return (
        !!doctor &&
        targetsForType.some(
          (target) =>
            getAssignmentConflicts(
              doctor,
              format(target.date, "yyyy-MM-dd"),
              target.shiftType,
              {
                shifts: ALL_CALENDAR_SHIFT_TYPES.map((type) => ({
                  date: format(target.date, "yyyy-MM-dd"),
                  shiftType: type,
                  doctorIds: doctors
                    .filter((entry) =>
                      isDoctorAssignedToDateShift(entry.id, {
                        date: target.date,
                        shiftType: type,
                      }),
                    )
                    .map((entry) => entry.id),
                })),
                unavailableByDoctor,
                vacationDoctorIdsByDate,
              },
            ).length > 0,
        )
      );
    },
    [
      vacationDoctorIdsByDate,
      doctors,
      isDoctorAssignedToDateShift,
      shiftTargetsMap,
      unavailableByDoctor,
    ],
  );

  const handleSelectionChange = React.useCallback(
    (shiftType: string, values: string[]) => {
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
    if (assignmentTargets.length === 0) {
      onOpenChange(false);
      return;
    }

    if (saving.current) return;
    saving.current = true;
    setIsSaving(true);
    try {
      await onAssign(
        assignmentTargets.map((target) => ({
          ...target,
          doctorIds: pendingAssignments[target.shiftType] ?? [],
        })),
      );
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to apply shift assignments", error);
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  const titleSuffix = React.useMemo(() => {
    if (isBatchMode) {
      const uniqueDays = new Set(
        assignmentTargets.map((target) => format(target.date, "yyyy-MM-dd")),
      );
      return ` - ${assignmentTargets.length} Felder / ${uniqueDays.size} Tage`;
    }

    return date ? ` - ${format(date, "d. MMM yyyy", { locale: de })}` : "";
  }, [assignmentTargets, date, isBatchMode]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{`Dienste zuweisen${titleSuffix}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {canShowOaDoctors ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
              <Switch
                checked={showOaDoctors}
                onCheckedChange={setShowOaDoctors}
                aria-label="OA auch anzeigen"
              />
              <span>OA auch anzeigen</span>
            </label>
          ) : null}
          {activeShiftTypes.map((shiftType) => {
            const selectedDoctorIds = pendingAssignments[shiftType] ?? [];
            const targetsForType = shiftTargetsMap.get(shiftType) ?? [];
            const selectedDoctorIdSet = new Set(selectedDoctorIds);

            const options = doctors
              .filter((doctor) => !doctor.disabled)
              .filter(
                (doctor) =>
                  isDoctorAllowed(doctor, shiftType) ||
                  selectedDoctorIdSet.has(doctor.id),
              )
              .map((doctor) => ({
                value: doctor.id.toString(),
                label: doctor.name,
                color: doctor.color ?? undefined,
                hasConflict: hasDoctorConflict(doctor.id, shiftType),
                oa: doctor.oa,
              }));

            const allowedSelectedDoctorIds = selectedDoctorIds.filter(
              (doctorId) => doctors.some((entry) => entry.id === doctorId),
            );

            const shiftSummary =
              targetsForType.length > 1
                ? `${targetsForType.length} Zellen ausgewählt`
                : null;

            return (
              <div key={shiftType} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-medium">
                      {getShiftLabel(shiftType)}
                    </h3>
                    {shiftSummary ? (
                      <p className="text-xs text-muted-foreground">
                        {shiftSummary}
                      </p>
                    ) : null}
                  </div>
                  <MultiSelect
                    options={options}
                    selected={allowedSelectedDoctorIds.map((doctorId) =>
                      doctorId.toString(),
                    )}
                    onChange={(values) =>
                      handleSelectionChange(shiftType, values)
                    }
                    placeholder="Ärzte auswählen..."
                    searchable
                    searchPlaceholder="Ärzte suchen..."
                    className="w-full sm:w-60"
                  />
                </div>

                {allowedSelectedDoctorIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {allowedSelectedDoctorIds.map((doctorId) => {
                      const assignedDoctor = doctors.find(
                        (doctor) => doctor.id === doctorId,
                      );
                      if (!assignedDoctor) return null;

                      return (
                        <Pill
                          key={`${assignedDoctor.id}-${shiftType}`}
                          color={assignedDoctor.color || undefined}
                          showX={hasDoctorConflict(
                            assignedDoctor.id,
                            shiftType,
                          )}
                          className={cn("text-xs")}
                        >
                          {assignedDoctor.name}
                        </Pill>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}

          <Button
            disabled={isSaving}
            onClick={handleApply}
            className="w-full border-2 border-green-200"
          >
            Übernehmen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
