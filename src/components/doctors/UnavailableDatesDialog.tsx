"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckSquare, Square } from "lucide-react";
import type { Doctor, UnavailableDate } from "@/lib/api";
import { getAllDatesInMonth } from "@/components/doctors/utils";

type UnavailableDatesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctor: Doctor | null;
  unavailableDates?: UnavailableDate[];
  isFetching: boolean;
  month: Date;
  setMonth: (month: Date) => void;
  onSave: (dates: string[]) => Promise<void>;
  isSaving: boolean;
};

export function UnavailableDatesDialog({
  open,
  onOpenChange,
  doctor,
  unavailableDates,
  isFetching,
  month,
  setMonth,
  onSave,
  isSaving,
}: UnavailableDatesDialogProps) {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);

  const computedSelectedDates = useMemo(() => {
    if (!open || !doctor) return [];
    return (unavailableDates ?? []).map((ud) => new Date(ud.date));
  }, [unavailableDates, open, doctor]);

  useEffect(() => {
    if (open && doctor && !isFetching && !hasInitialized) {
      setSelectedDates(computedSelectedDates);
      setHasInitialized(true);
    }
  }, [open, doctor, isFetching, hasInitialized, computedSelectedDates]);

  useEffect(() => {
    if (!open) {
      setSelectedDates([]);
      setHasInitialized(false);
    }
  }, [open]);

  const handleSelectAllMonth = () => {
    if (!doctor) return;
    const allDatesInMonth = getAllDatesInMonth(month);
    const mergedDates = [...selectedDates];

    allDatesInMonth.forEach((date) => {
      const dateString = format(date, "yyyy-MM-dd");
      const exists = mergedDates.some(
        (existingDate) => format(existingDate, "yyyy-MM-dd") === dateString,
      );
      if (!exists) {
        mergedDates.push(date);
      }
    });

    setSelectedDates(mergedDates);
  };

  const handleDeselectAllMonth = () => {
    if (!doctor) return;
    const datesToKeep = selectedDates.filter(
      (date) =>
        !(
          date.getMonth() === month.getMonth() &&
          date.getFullYear() === month.getFullYear()
        ),
    );

    setSelectedDates(datesToKeep);
  };

  const handleSave = async () => {
    if (!doctor) return;
    const dateStrings = selectedDates.map((date) => format(date, "yyyy-MM-dd"));
    await onSave(dateStrings);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            <div className="flex-col items-center gap-2">
              <h1>Unavailable Dates</h1>
              <span className="text-sm text-muted-foreground">
                {doctor?.name}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col gap-2 items-center">
            <Label>Select dates when this doctor cannot work:</Label>
            <Calendar
              mode="multiple"
              selected={selectedDates}
              onSelect={(dates) => setSelectedDates(dates || [])}
              month={month}
              onMonthChange={setMonth}
              showOutsideDays={false}
              className="rounded-md border mt-2"
            />
          </div>
          <div className="flex justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAllMonth}
              title="Select all days in this month"
            >
              <CheckSquare className="w-4 h-4" />
              All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeselectAllMonth}
              title="Deselect all days in this month"
            >
              <Square className="w-4 h-4" />
              Nothing
            </Button>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
