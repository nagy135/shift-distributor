"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarSkeleton } from "@/components/ui/calendar-skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckSquare, History, Square } from "lucide-react";
import type {
  Doctor,
  UnavailableDate,
  UnavailableDateChangeLog,
} from "@/lib/api";
import { getAllDatesInMonth } from "@/components/doctors/utils";

type UnavailableDatesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctor: Doctor | null;
  unavailableDates?: UnavailableDate[];
  unavailableDateLogs?: UnavailableDateChangeLog[];
  isFetching: boolean;
  isLogsFetching: boolean;
  month: Date;
  setMonth: (month: Date) => void;
  onSave: (dates: string[]) => Promise<void>;
  isSaving: boolean;
  canViewLogs: boolean;
};

function formatLogTimestamp(value: number | string) {
  const date = typeof value === "number" ? new Date(value) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return format(date, "d. MMMM yyyy, HH:mm", { locale: de });
}

function formatLogDate(date: string) {
  return format(new Date(date), "d. MMMM yyyy", { locale: de });
}

export function UnavailableDatesDialog({
  open,
  onOpenChange,
  doctor,
  unavailableDates,
  unavailableDateLogs,
  isFetching,
  isLogsFetching,
  month,
  setMonth,
  onSave,
  isSaving,
  canViewLogs,
}: UnavailableDatesDialogProps) {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);

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
      setIsLogDialogOpen(false);
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
    const monthDate = month instanceof Date ? month : new Date(month);
    const datesToKeep = selectedDates.filter(
      (date) =>
        !(
          date.getMonth() === monthDate.getMonth() &&
          date.getFullYear() === monthDate.getFullYear()
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <div className="flex-col items-center gap-2">
                <h1>Dienstwünsche</h1>
                <span className="text-sm text-muted-foreground">
                  {doctor?.name}
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-2 items-center">
              <Label>Dienstwünsche für diesen Arzt auswählen:</Label>
              {isFetching ? (
                <div className="mt-2 w-full rounded-md border flex justify-center">
                  <CalendarSkeleton size="sm" />
                </div>
              ) : (
                <Calendar
                  mode="multiple"
                  selected={selectedDates}
                  onSelect={(dates) => setSelectedDates(dates || [])}
                  month={month}
                  onMonthChange={setMonth}
                  showOutsideDays={false}
                  className="mt-2 rounded-md border"
                />
              )}
            </div>
            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAllMonth}
                title="Alle Tage in diesem Monat auswählen"
              >
                <CheckSquare className="h-4 w-4" />
                Alle
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeselectAllMonth}
                title="Alle Tage in diesem Monat abwählen"
              >
                <Square className="h-4 w-4" />
                Keine
              </Button>
            </div>
            {canViewLogs && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsLogDialogOpen(true)}
              >
                <History className="h-4 w-4" />
                Aenderungsprotokoll anzeigen
              </Button>
            )}
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                className="flex-1"
                disabled={isSaving}
              >
                {isSaving ? "Wird gespeichert..." : "Änderungen speichern"}
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Abbrechen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isLogDialogOpen} onOpenChange={setIsLogDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Aenderungsprotokoll</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{doctor?.name}</p>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {isLogsFetching ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Protokoll wird geladen...
                </div>
              ) : unavailableDateLogs && unavailableDateLogs.length > 0 ? (
                unavailableDateLogs.map((log) => {
                  const added = log.changes.filter(
                    (change) => change.changeType === "added",
                  );
                  const removed = log.changes.filter(
                    (change) => change.changeType === "removed",
                  );

                  return (
                    <div key={log.id} className="rounded-lg border p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="font-medium">
                            {formatLogTimestamp(log.createdAt)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Bearbeitet von {log.userEmail}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          +{log.addedCount} / -{log.removedCount}
                        </div>
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        <div>
                          <span className="font-medium text-emerald-700">
                            Hinzugefuegt:
                          </span>{" "}
                          {added.length > 0
                            ? added
                                .map((change) => formatLogDate(change.date))
                                .join(", ")
                            : "-"}
                        </div>
                        <div>
                          <span className="font-medium text-rose-700">
                            Entfernt:
                          </span>{" "}
                          {removed.length > 0
                            ? removed
                                .map((change) => formatLogDate(change.date))
                                .join(", ")
                            : "-"}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Noch keine Aenderungen protokolliert.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
