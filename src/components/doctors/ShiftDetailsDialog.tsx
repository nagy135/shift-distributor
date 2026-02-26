"use client";

import { format } from "date-fns";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SHIFT_LABELS } from "@/lib/shifts";
import type { Doctor, Shift } from "@/lib/api";
import { getDoctorShiftsForMonth } from "@/components/doctors/utils";

type ShiftDetailsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctor: Doctor | null;
  month: Date;
  shifts: Shift[];
  onExport: () => Promise<void>;
};

export function ShiftDetailsDialog({
  open,
  onOpenChange,
  doctor,
  month,
  shifts,
  onExport,
}: ShiftDetailsDialogProps) {
  const monthlyShifts = doctor
    ? getDoctorShiftsForMonth(doctor.id, month, shifts)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            <div className="flex-col items-center gap-2">
              <h1>Shift Details</h1>
              <span className="text-sm text-muted-foreground">
                {doctor?.name}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {doctor && (
            <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto min-h-0">
                {monthlyShifts.length > 0 ? (
                  <div className="space-y-2">
                    {monthlyShifts.map((shift) => (
                      <div
                        key={`${shift.date}-${shift.shiftType}`}
                        className="flex justify-between items-center p-2 border rounded"
                      >
                        <span className="font-medium">
                          {format(new Date(shift.date), "MMM d, yyyy")}
                        </span>
                        <span className="text-sm text-muted-foreground capitalize">
                          {SHIFT_LABELS[
                            shift.shiftType as keyof typeof SHIFT_LABELS
                          ] ?? shift.shiftType}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    No shifts assigned for {format(month, "MMMM yyyy")}.
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="flex-shrink-0 flex gap-2">
            <Button
              onClick={onExport}
              disabled={!doctor || monthlyShifts.length === 0}
              className="flex-1"
            >
              <Download />
              Export
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
