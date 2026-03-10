"use client";

import { useEffect, useMemo, useState } from "react";
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
import { getDoctorShiftCount } from "@/components/doctors/utils";
import { useAuth } from "@/lib/auth-client";
import { SHIFT_TYPES } from "@/lib/shifts";

export default function DoctorsPage() {
  const { user } = useAuth();
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
  const isShiftAssigner = user?.role === "shift_assigner";
  const currentDoctorId = user?.doctorId ?? null;

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
      shifts: doctorPageShifts,
    });
  };

  const filteredDoctors = doctors.filter((doctor) => {
    if (!isShiftAssigner && doctor.disabled) {
      return false;
    }

    return oaOnly ? doctor.oa : !doctor.oa;
  });
  const doctorPageShifts = allShifts.filter((shift) =>
    SHIFT_TYPES.includes(shift.shiftType as (typeof SHIFT_TYPES)[number]),
  );

  const currentDoctor = useMemo(
    () => {
      const doctor = doctors.find((entry) => entry.id === currentDoctorId) ?? null;

      if (!isShiftAssigner && doctor?.disabled) {
        return null;
      }

      return doctor;
    },
    [currentDoctorId, doctors, isShiftAssigner],
  );

  const doctorsByShiftCount = useMemo(
    () => {
      const list = [...filteredDoctors];

      if (
        currentDoctor &&
        !list.some((doctor) => doctor.id === currentDoctor.id)
      ) {
        list.push(currentDoctor);
      }

      return list.sort((left, right) => {
        const countDifference =
          getDoctorShiftCount(right.id, doctorPageShifts, selectedMonth) -
          getDoctorShiftCount(left.id, doctorPageShifts, selectedMonth);

        if (countDifference !== 0) {
          return countDifference;
        }

        return left.name.localeCompare(right.name);
      });
    },
    [currentDoctor, doctorPageShifts, filteredDoctors, selectedMonth],
  );

  useEffect(() => {
    if (!isShiftAssigner) {
      setSelectedDoctor(currentDoctor);
    }
  }, [currentDoctor, isShiftAssigner]);

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
            {isShiftAssigner && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                Arzt hinzufügen
              </Button>
            )}
          </div>
          }
        />
      <AddDoctorDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAddDoctor={handleAddDoctor}
        isSaving={createDoctorMutation.isPending}
      />

      {isShiftAssigner ? (
        <DoctorList
          doctors={filteredDoctors}
          shifts={doctorPageShifts}
          month={selectedMonth}
          onOpenShiftDetails={openShiftDetailsDialog}
          onOpenUnavailable={openUnavailableDialog}
          onOpenSettings={openColorDialog}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <section className="rounded-lg border bg-card p-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Ärzteliste</h2>
              <p className="text-sm text-muted-foreground">
                Die meisten Dienste stehen oben. Ihr Eintrag ist hervorgehoben.
              </p>
            </div>

            <div className="space-y-2">
              {doctorsByShiftCount.map((doctor, index) => {
                const isCurrentDoctor = doctor.id === currentDoctorId;
                const shiftCount = getDoctorShiftCount(
                  doctor.id,
                  doctorPageShifts,
                  selectedMonth,
                );

                return (
                  <div
                    key={doctor.id}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${isCurrentDoctor ? "border-primary bg-primary/10" : "bg-background"}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-xs text-muted-foreground">
                        {index + 1}.
                      </span>
                      <div>
                        <div className="font-medium">{doctor.name}</div>
                        {isCurrentDoctor && (
                          <div className="text-xs text-primary">Sie</div>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {shiftCount}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Meine Angaben</h2>
              <p className="text-sm text-muted-foreground">
                Hier pflegen Sie Ihre eigenen Dienstwünsche.
              </p>
            </div>

            {currentDoctor ? (
              <DoctorList
                doctors={[currentDoctor]}
                shifts={doctorPageShifts}
                month={selectedMonth}
                onOpenShiftDetails={openShiftDetailsDialog}
                onOpenUnavailable={openUnavailableDialog}
                onOpenSettings={openColorDialog}
                showSettings={false}
                emptyMessage=""
              />
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Ihrem Benutzer ist aktuell kein Arzt zugeordnet.
              </div>
            )}
          </section>
        </div>
      )}

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
        shifts={doctorPageShifts}
        onExport={handleExportDoctorShifts}
      />
    </div>
  );
}
