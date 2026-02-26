"use client";

import { useState } from "react";
import { MonthSelector } from "@/components/MonthSelector";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMonthStore } from "@/lib/month-store";
import type { Doctor } from "@/lib/api";
import { useDoctorsQueries } from "@/components/doctors/useDoctorsQueries";
import { AddDoctorDialog } from "@/components/doctors/AddDoctorDialog";
import { DoctorList } from "@/components/doctors/DoctorList";
import { DoctorSettingsDialog } from "@/components/doctors/DoctorSettingsDialog";
import { UnavailableDatesDialog } from "@/components/doctors/UnavailableDatesDialog";
import { ShiftDetailsDialog } from "@/components/doctors/ShiftDetailsDialog";
import { exportDoctorShifts } from "@/components/doctors/export-doctor-shifts";

export default function DoctorsPage() {
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isUnavailableDialogOpen, setIsUnavailableDialogOpen] = useState(false);
  const [isShiftDetailsDialogOpen, setIsShiftDetailsDialogOpen] =
    useState(false);
  const [isColorDialogOpen, setIsColorDialogOpen] = useState(false);
  const [oaOnly, setOaOnly] = useState(false);
  const { month: selectedMonth, setMonth } = useMonthStore();
  const {
    doctors,
    unavailableDates,
    isUnavailableDatesFetching,
    allShifts,
    createDoctorMutation,
    updateUnavailableDatesMutation,
    updateDoctorMutation,
  } = useDoctorsQueries({
    selectedDoctorId: selectedDoctor?.id,
    onDoctorCreated: () => setIsAddDialogOpen(false),
    onUnavailableUpdated: () => setIsUnavailableDialogOpen(false),
    onDoctorUpdated: () => setIsColorDialogOpen(false),
  });

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
    setIsColorDialogOpen(true);
  };
  const handleAddDoctor = async (name: string) => {
    try {
      await createDoctorMutation.mutateAsync({ name });
    } catch (error) {
      console.error("Error adding doctor:", error);
    }
  };

  const handleUpdateUnavailableDates = async (dates: string[]) => {
    if (!selectedDoctor) return;

    try {
      await updateUnavailableDatesMutation.mutateAsync({
        doctorId: selectedDoctor.id,
        dates,
      });
    } catch (error) {
      console.error("Error updating unavailable dates:", error);
    }
  };

  const handleUpdateDoctorSettings = async (payload: {
    id: number;
    color: string | null;
    name: string;
    unavailableShiftTypes: string[];
    disabled: boolean;
    oa: boolean;
  }) => {
    try {
      await updateDoctorMutation.mutateAsync(payload);
    } catch (error) {
      console.error("Error updating doctor:", error);
    }
  };

  const handleExportDoctorShifts = async () => {
    if (!selectedDoctor) return;
    await exportDoctorShifts({
      doctor: selectedDoctor,
      month: selectedMonth,
      shifts: allShifts,
    });
  };

  const filteredDoctors = doctors.filter((doctor) =>
    oaOnly ? doctor.oa : !doctor.oa,
  );

  return (
    <div className="space-y-6">
      <MonthSelector
        rightActions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="oa-toggle" className="cursor-pointer">
                OA
              </Label>
              <Switch
                id="oa-toggle"
                checked={oaOnly}
                onCheckedChange={setOaOnly}
              />
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)}>Add Doctor</Button>
          </div>
        }
      />
      <AddDoctorDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAddDoctor={handleAddDoctor}
        isSaving={createDoctorMutation.isPending}
      />

      <DoctorList
        doctors={filteredDoctors}
        shifts={allShifts}
        month={selectedMonth}
        onOpenShiftDetails={openShiftDetailsDialog}
        onOpenUnavailable={openUnavailableDialog}
        onOpenSettings={openColorDialog}
      />

      <DoctorSettingsDialog
        open={isColorDialogOpen}
        onOpenChange={setIsColorDialogOpen}
        doctor={selectedDoctor}
        onSave={handleUpdateDoctorSettings}
        isSaving={updateDoctorMutation.isPending}
      />

      <UnavailableDatesDialog
        open={isUnavailableDialogOpen}
        onOpenChange={setIsUnavailableDialogOpen}
        doctor={selectedDoctor}
        unavailableDates={unavailableDates}
        isFetching={isUnavailableDatesFetching}
        month={selectedMonth}
        setMonth={setMonth}
        onSave={handleUpdateUnavailableDates}
        isSaving={updateUnavailableDatesMutation.isPending}
      />

      <ShiftDetailsDialog
        open={isShiftDetailsDialogOpen}
        onOpenChange={setIsShiftDetailsDialogOpen}
        doctor={selectedDoctor}
        month={selectedMonth}
        shifts={allShifts}
        onExport={handleExportDoctorShifts}
      />
    </div>
  );
}
