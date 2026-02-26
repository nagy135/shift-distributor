"use client";

import { useState } from "react";
import { format, isSameMonth } from "date-fns";
import { SHIFT_LABELS, SHIFT_TYPES, SHIFT_DEFS } from "@/lib/shifts";
import { Pill } from "@/components/ui/pill";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MultiSelect } from "@/components/ui/multiselect";
import { Switch } from "@/components/ui/switch";
import {
  doctorsApi,
  unavailableDatesApi,
  shiftsApi,
  type Doctor,
  type UnavailableDate,
} from "@/lib/api";
import { Download, CheckSquare, Square } from "lucide-react";
import React from "react";
import { MonthSelector } from "@/components/MonthSelector";
import { useMonthStore } from "@/lib/month-store";

export default function DoctorsPage() {
  const [newDoctorName, setNewDoctorName] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDatesByDoctor, setSelectedDatesByDoctor] = useState<
    Record<number, Date[]>
  >({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isUnavailableDialogOpen, setIsUnavailableDialogOpen] = useState(false);
  const [isShiftDetailsDialogOpen, setIsShiftDetailsDialogOpen] =
    useState(false);
  const [isColorDialogOpen, setIsColorDialogOpen] = useState(false);
  const [pendingColor, setPendingColor] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState<string>("");
  const [pendingUnavailableShiftTypes, setPendingUnavailableShiftTypes] =
    useState<string[]>([]);
  const [pendingDisabled, setPendingDisabled] = useState<boolean>(false);
  const { month: selectedMonth, setMonth } = useMonthStore();
  const queryClient = useQueryClient();

  // Queries
  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors"],
    queryFn: doctorsApi.getAll,
  });

  const { data: unavailableDates, isFetching: isUnavailableDatesFetching } =
    useQuery({
      queryKey: ["unavailable-dates", selectedDoctor?.id],
      queryFn: () =>
        selectedDoctor
          ? unavailableDatesApi.getByDoctor(selectedDoctor.id)
          : Promise.resolve([]),
      enabled: !!selectedDoctor,
    });

  const { data: allShifts = [] } = useQuery({
    queryKey: ["shifts"],
    queryFn: shiftsApi.getAll,
  });

  // Mutations
  const createDoctorMutation = useMutation({
    mutationFn: doctorsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      setNewDoctorName("");
      setIsAddDialogOpen(false);
    },
  });

  const updateUnavailableDatesMutation = useMutation({
    mutationFn: ({ doctorId, dates }: { doctorId: number; dates: string[] }) =>
      unavailableDatesApi.update(doctorId, dates),
    onSuccess: () => {
      if (selectedDoctor) {
        queryClient.invalidateQueries({
          queryKey: ["unavailable-dates", selectedDoctor.id],
        });
      }
      // Refresh calendar/table conflict highlights
      queryClient.invalidateQueries({ queryKey: ["unavailable-by-doctor"] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      setIsUnavailableDialogOpen(false);
    },
  });

  const handleAddDoctor = async () => {
    if (!newDoctorName.trim()) return;

    try {
      await createDoctorMutation.mutateAsync({
        name: newDoctorName.trim(),
      });
    } catch (error) {
      console.error("Error adding doctor:", error);
    }
  };

  const handleUpdateUnavailableDates = async () => {
    if (!selectedDoctor) return;

    try {
      const selectedDates = selectedDatesByDoctor[selectedDoctor.id] || [];
      const dateStrings = selectedDates.map((date) =>
        format(date, "yyyy-MM-dd"),
      );
      await updateUnavailableDatesMutation.mutateAsync({
        doctorId: selectedDoctor.id,
        dates: dateStrings,
      });
    } catch (error) {
      console.error("Error updating unavailable dates:", error);
    }
  };

  const openUnavailableDialog = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setIsUnavailableDialogOpen(true);
  };

  const openShiftDetailsDialog = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setIsShiftDetailsDialogOpen(true);
  };

  const openColorDialog = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setPendingColor(doctor.color ?? "#22c55e");
    setPendingName(doctor.name);
    setPendingUnavailableShiftTypes(
      doctor.unavailableShiftTypes &&
        Array.isArray(doctor.unavailableShiftTypes)
        ? doctor.unavailableShiftTypes
        : [],
    );
    setPendingDisabled(doctor.disabled ?? false);
    setIsColorDialogOpen(true);
  };

  const updateColorMutation = useMutation({
    mutationFn: ({
      id,
      color,
      name,
      unavailableShiftTypes,
      disabled,
    }: {
      id: number;
      color: string | null;
      name: string;
      unavailableShiftTypes: string[];
      disabled: boolean;
    }) =>
      doctorsApi.update(id, {
        color: color ?? null,
        name,
        unavailableShiftTypes,
        disabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      setIsColorDialogOpen(false);
    },
  });

  const handleUpdateColor = async () => {
    if (!selectedDoctor) return;
    await updateColorMutation.mutateAsync({
      id: selectedDoctor.id,
      color: pendingColor ?? null,
      name: pendingName,
      unavailableShiftTypes: pendingUnavailableShiftTypes,
      disabled: pendingDisabled,
    });
  };

  // Helper functions for selecting all/deselecting all dates in a month
  const getAllDatesInMonth = (month: Date | string): Date[] => {
    const monthDate = month instanceof Date ? month : new Date(month);
    const year = monthDate.getFullYear();
    const monthIndex = monthDate.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const dates: Date[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      dates.push(new Date(year, monthIndex, day));
    }

    return dates;
  };

  const handleSelectAllMonth = () => {
    if (!selectedDoctor) return;
    const currentDates = selectedDatesByDoctor[selectedDoctor.id] || [];
    const allDatesInMonth = getAllDatesInMonth(selectedMonth);

    // Merge current dates with all dates from this month, removing duplicates
    const mergedDates = [...currentDates];
    allDatesInMonth.forEach((date) => {
      const dateString = format(date, "yyyy-MM-dd");
      const exists = mergedDates.some(
        (existingDate) => format(existingDate, "yyyy-MM-dd") === dateString,
      );
      if (!exists) {
        mergedDates.push(date);
      }
    });

    setSelectedDatesByDoctor((prev) => ({
      ...prev,
      [selectedDoctor.id]: mergedDates,
    }));
  };

  const handleDeselectAllMonth = () => {
    if (!selectedDoctor) return;
    const currentDates = selectedDatesByDoctor[selectedDoctor.id] || [];
    const datesToKeep = currentDates.filter(
      (date) => !isSameMonth(date, selectedMonth),
    );

    setSelectedDatesByDoctor((prev) => ({
      ...prev,
      [selectedDoctor.id]: datesToKeep,
    }));
  };

  // Helper functions
  const getDoctorShiftCount = (doctorId: number) => {
    return allShifts.filter(
      (shift) =>
        Array.isArray(shift.doctorIds) &&
        shift.doctorIds.includes(doctorId) &&
        isSameMonth(new Date(shift.date), selectedMonth),
    ).length;
  };

  const getDoctorShifts = (doctorId: number) => {
    return allShifts
      .filter(
        (shift) =>
          Array.isArray(shift.doctorIds) && shift.doctorIds.includes(doctorId),
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const getDoctorShiftsForMonth = (doctorId: number, month: Date) => {
    return getDoctorShifts(doctorId).filter((shift) =>
      isSameMonth(new Date(shift.date), month),
    );
  };

  const handleExportDoctorShifts = async () => {
    if (!selectedDoctor) return;
    const monthlyShifts = getDoctorShiftsForMonth(
      selectedDoctor.id,
      selectedMonth,
    );
    if (monthlyShifts.length === 0) return;

    const rows = monthlyShifts.map((shift) => ({
      Date: format(new Date(shift.date), "MMM d, yyyy"),
      Shift:
        SHIFT_LABELS[shift.shiftType as keyof typeof SHIFT_LABELS] ??
        shift.shiftType,
    }));

    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Shifts");

    const safeName = selectedDoctor.name.replace(/[^\w\-]+/g, "_");
    const fileName = `${safeName}-${format(selectedMonth, "yyyy-MM")}-shifts.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Get current selected dates for the selected doctor
  const currentSelectedDates = selectedDoctor
    ? selectedDatesByDoctor[selectedDoctor.id] || []
    : [];

  // Compute selected dates from unavailable dates - only use if we haven't started editing
  const computedSelectedDates = React.useMemo(() => {
    if (!isUnavailableDialogOpen || !selectedDoctor) return [];
    return (unavailableDates ?? []).map(
      (ud: UnavailableDate) => new Date(ud.date),
    );
  }, [unavailableDates, isUnavailableDialogOpen, selectedDoctor]);

  // Initialize dates when dialog opens (only once per dialog session)
  React.useEffect(() => {
    if (
      isUnavailableDialogOpen &&
      selectedDoctor &&
      !isUnavailableDatesFetching
    ) {
      const currentDates = selectedDatesByDoctor[selectedDoctor.id];
      // Only initialize if state hasn't been set yet for this doctor
      if (currentDates === undefined) {
        setSelectedDatesByDoctor((prev) => ({
          ...prev,
          [selectedDoctor.id]: computedSelectedDates,
        }));
      }
    }
  }, [
    computedSelectedDates,
    isUnavailableDatesFetching,
    isUnavailableDialogOpen,
    selectedDoctor,
    selectedDatesByDoctor,
  ]);

  // Clear state when dialog closes to reset for next time
  React.useEffect(() => {
    if (!isUnavailableDialogOpen && selectedDoctor) {
      setSelectedDatesByDoctor((prev) => {
        const newState = { ...prev };
        delete newState[selectedDoctor.id];
        return newState;
      });
    }
  }, [isUnavailableDialogOpen, selectedDoctor]);

  return (
    <div className="space-y-6">
      <MonthSelector
        rightActions={
          <Button onClick={() => setIsAddDialogOpen(true)}>Add Doctor</Button>
        }
      />
      <div className="flex items-center justify-between">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Doctor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newDoctorName}
                  onChange={(e) => setNewDoctorName(e.target.value)}
                  placeholder="Enter doctor's name"
                  autoComplete="off"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleAddDoctor();
                    }
                  }}
                />
              </div>
              <Button
                onClick={handleAddDoctor}
                className="w-full"
                disabled={createDoctorMutation.isPending}
              >
                {createDoctorMutation.isPending ? "Adding..." : "Add Doctor"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {[...doctors]
          .sort((a, b) => {
            // Sort disabled doctors to the end
            if (a.disabled && !b.disabled) return 1;
            if (!a.disabled && b.disabled) return -1;
            return 0;
          })
          .map((doctor) => (
            <div
              key={doctor.id}
              className={`p-4 border rounded-lg ${doctor.disabled ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Pill
                      color={doctor.color || undefined}
                      className="cursor-pointer"
                      onClick={() => openColorDialog(doctor)}
                    >
                      {doctor.name}
                    </Pill>
                    {doctor.disabled && (
                      <span className="text-sm bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded">
                        Disabled
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground">
                      ({getDoctorShiftCount(doctor.id)})
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openShiftDetailsDialog(doctor)}
                  >
                    Shifts
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openUnavailableDialog(doctor)}
                  >
                    Unavailable
                  </Button>
                </div>
              </div>
            </div>
          ))}
        {/* Color Picker Dialog */}
        <Dialog open={isColorDialogOpen} onOpenChange={setIsColorDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                Doctor Settings - {selectedDoctor?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={pendingName}
                  onChange={(e) => setPendingName(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <Pill color={pendingColor || undefined}>Preview</Pill>
                <input
                  type="color"
                  value={pendingColor ?? "#22c55e"}
                  onChange={(e) => setPendingColor(e.target.value)}
                  className="h-10 w-16 p-1 border rounded"
                />
              </div>
              <div className="space-y-2">
                <Label>Unavailable Shift Types</Label>
                <MultiSelect
                  options={SHIFT_TYPES.map((shiftType) => ({
                    value: shiftType,
                    label: SHIFT_DEFS[shiftType].label,
                  }))}
                  selected={pendingUnavailableShiftTypes}
                  onChange={setPendingUnavailableShiftTypes}
                  placeholder="Select shift types this doctor cannot do..."
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <Label htmlFor="disabled-toggle" className="cursor-pointer">
                  Disabled
                </Label>
                <Switch
                  id="disabled-toggle"
                  checked={pendingDisabled}
                  onCheckedChange={setPendingDisabled}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleUpdateColor}
                  className="flex-1"
                  disabled={updateColorMutation.isPending}
                >
                  {updateColorMutation.isPending ? "Saving…" : "Save"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsColorDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {doctors.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No doctors added yet. Add your first doctor to get started.
          </div>
        )}
      </div>

      {/* Unavailable Dates Dialog */}
      <Dialog
        open={isUnavailableDialogOpen}
        onOpenChange={setIsUnavailableDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <div className="flex-col items-center gap-2">
                <h1>Unavailable Dates</h1>
                <span className="text-sm text-muted-foreground">
                  {selectedDoctor?.name}
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-2 items-center">
              <Label>Select dates when this doctor cannot work:</Label>
              <Calendar
                mode="multiple"
                selected={currentSelectedDates}
                onSelect={(dates) => {
                  if (selectedDoctor) {
                    setSelectedDatesByDoctor((prev) => ({
                      ...prev,
                      [selectedDoctor.id]: dates || [],
                    }));
                  }
                }}
                month={selectedMonth}
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
              <Button
                onClick={handleUpdateUnavailableDates}
                className="flex-1"
                disabled={updateUnavailableDatesMutation.isPending}
              >
                {updateUnavailableDatesMutation.isPending
                  ? "Saving..."
                  : "Save Changes"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsUnavailableDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Shift Details Dialog */}
      <Dialog
        open={isShiftDetailsDialogOpen}
        onOpenChange={setIsShiftDetailsDialogOpen}
      >
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              <div className="flex-col items-center gap-2">
                <h1>Shift Details</h1>
                <span className="text-sm text-muted-foreground">
                  {selectedDoctor?.name}
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {selectedDoctor && (
              <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto min-h-0">
                  {getDoctorShiftsForMonth(selectedDoctor.id, selectedMonth)
                    .length > 0 ? (
                    <div className="space-y-2">
                      {getDoctorShiftsForMonth(
                        selectedDoctor.id,
                        selectedMonth,
                      ).map((shift) => (
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
                      No shifts assigned for{" "}
                      {format(selectedMonth, "MMMM yyyy")}.
                    </p>
                  )}
                </div>
              </div>
            )}
            <div className="flex-shrink-0 flex gap-2">
              <Button
                onClick={handleExportDoctorShifts}
                disabled={
                  !selectedDoctor ||
                  getDoctorShiftsForMonth(selectedDoctor.id, selectedMonth)
                    .length === 0
                }
                className="flex-1"
              >
                <Download />
                Export
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsShiftDetailsDialogOpen(false)}
                className="flex-1"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
