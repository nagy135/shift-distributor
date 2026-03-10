"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MultiSelect } from "@/components/ui/multiselect";
import { Switch } from "@/components/ui/switch";
import { Pill } from "@/components/ui/pill";
import { SHIFT_DEFS, SHIFT_TYPES } from "@/lib/shifts";
import type { Doctor } from "@/lib/api";

type DoctorSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctor: Doctor | null;
  onSave: (payload: {
    id: number;
    color: string | null;
    name: string;
    unavailableShiftTypes: string[];
    disabled: boolean;
    oa: boolean;
  }) => Promise<void>;
  isSaving: boolean;
};

export function DoctorSettingsDialog({
  open,
  onOpenChange,
  doctor,
  onSave,
  isSaving,
}: DoctorSettingsDialogProps) {
  const [pendingColor, setPendingColor] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState<string>("");
  const [pendingUnavailableShiftTypes, setPendingUnavailableShiftTypes] =
    useState<string[]>([]);
  const [pendingDisabled, setPendingDisabled] = useState<boolean>(false);
  const [pendingOa, setPendingOa] = useState<boolean>(false);

  useEffect(() => {
    if (!open || !doctor) return;
    setPendingColor(doctor.color ?? "#22c55e");
    setPendingName(doctor.name);
    setPendingUnavailableShiftTypes(
      doctor.unavailableShiftTypes &&
        Array.isArray(doctor.unavailableShiftTypes)
        ? doctor.unavailableShiftTypes
        : [],
    );
    setPendingDisabled(doctor.disabled ?? false);
    setPendingOa(doctor.oa ?? false);
  }, [open, doctor]);

  const handleSave = async () => {
    if (!doctor) return;
    await onSave({
      id: doctor.id,
      color: pendingColor ?? null,
      name: pendingName,
      unavailableShiftTypes: pendingUnavailableShiftTypes,
      disabled: pendingDisabled,
      oa: pendingOa,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md min-w-0">
        <DialogHeader>
          <DialogTitle className="break-words pr-8">
            Ärzteeinstellungen - {doctor?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="min-w-0 space-y-4">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={pendingName}
              onChange={(event) => setPendingName(event.target.value)}
            />
          </div>
          <div className="min-w-0 flex flex-wrap items-center gap-3">
            <Pill color={pendingColor || undefined}>Vorschau</Pill>
            <input
              type="color"
              value={pendingColor ?? "#22c55e"}
              onChange={(event) => setPendingColor(event.target.value)}
              className="h-10 w-16 p-1 border rounded"
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label>Nicht verfügbare Diensttypen</Label>
            <MultiSelect
              className="min-w-0"
              options={SHIFT_TYPES.map((shiftType) => ({
                value: shiftType,
                label: SHIFT_DEFS[shiftType].label,
              }))}
              selected={pendingUnavailableShiftTypes}
              onChange={setPendingUnavailableShiftTypes}
              placeholder="Diensttypen auswählen, die dieser Arzt nicht übernehmen kann..."
            />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
            <Label htmlFor="disabled-toggle" className="cursor-pointer">
              Deaktiviert
            </Label>
            <Switch
              id="disabled-toggle"
              checked={pendingDisabled}
              onCheckedChange={setPendingDisabled}
            />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
            <Label htmlFor="oa-toggle" className="cursor-pointer">
              Oberarzt
            </Label>
            <Switch
              id="oa-toggle"
              checked={pendingOa}
              onCheckedChange={setPendingOa}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleSave}
              className="w-full sm:flex-1"
              disabled={isSaving}
            >
              {isSaving ? "Wird gespeichert..." : "Speichern"}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:flex-1"
            >
              Abbrechen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
