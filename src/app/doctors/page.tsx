"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { doctorsApi, unavailableDatesApi, shiftsApi, type Doctor, type UnavailableDate } from "@/lib/api";
import React from "react";

export default function DoctorsPage() {
  const [newDoctorName, setNewDoctorName] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDatesByDoctor, setSelectedDatesByDoctor] = useState<Record<number, Date[]>>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isUnavailableDialogOpen, setIsUnavailableDialogOpen] = useState(false);
  const [isShiftDetailsDialogOpen, setIsShiftDetailsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Queries
  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors'],
    queryFn: doctorsApi.getAll,
  });

  const { data: unavailableDates = [] } = useQuery({
    queryKey: ['unavailable-dates', selectedDoctor?.id],
    queryFn: () => selectedDoctor ? unavailableDatesApi.getByDoctor(selectedDoctor.id) : Promise.resolve([]),
    enabled: !!selectedDoctor,
  });

  const { data: allShifts = [] } = useQuery({
    queryKey: ['shifts'],
    queryFn: shiftsApi.getAll,
  });

  // Mutations
  const createDoctorMutation = useMutation({
    mutationFn: doctorsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      setNewDoctorName("");
      setIsAddDialogOpen(false);
    },
  });

  const updateUnavailableDatesMutation = useMutation({
    mutationFn: ({ doctorId, dates }: { doctorId: number; dates: string[] }) =>
      unavailableDatesApi.update(doctorId, dates),
    onSuccess: () => {
      if (selectedDoctor) {
        queryClient.invalidateQueries({ queryKey: ['unavailable-dates', selectedDoctor.id] });
      }
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
      console.error('Error adding doctor:', error);
    }
  };

  const handleUpdateUnavailableDates = async () => {
    if (!selectedDoctor) return;

    try {
      const selectedDates = selectedDatesByDoctor[selectedDoctor.id] || [];
      const dateStrings = selectedDates.map(date => format(date, 'yyyy-MM-dd'));
      await updateUnavailableDatesMutation.mutateAsync({
        doctorId: selectedDoctor.id,
        dates: dateStrings,
      });
    } catch (error) {
      console.error('Error updating unavailable dates:', error);
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

  // Helper functions
  const getDoctorShiftCount = (doctorId: number) => {
    return allShifts.filter(shift => shift.doctorId === doctorId).length;
  };

  const getDoctorShifts = (doctorId: number) => {
    return allShifts
      .filter(shift => shift.doctorId === doctorId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // Get current selected dates for the selected doctor
  const currentSelectedDates = selectedDoctor ? selectedDatesByDoctor[selectedDoctor.id] || [] : [];

  // Compute selected dates from unavailable dates
  const computedSelectedDates = React.useMemo(() => {
    if (!isUnavailableDialogOpen || !selectedDoctor) return [];
    return unavailableDates.map((ud: UnavailableDate) => new Date(ud.date));
  }, [unavailableDates, isUnavailableDialogOpen, selectedDoctor]);





  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Doctors</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>Add Doctor</Button>
          </DialogTrigger>
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
                    if (e.key === 'Enter') {
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
                {createDoctorMutation.isPending ? 'Adding...' : 'Add Doctor'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {doctors.map((doctor) => (
          <div key={doctor.id} className="p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{doctor.name}</h3>
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

        {doctors.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No doctors added yet. Add your first doctor to get started.
          </div>
        )}
      </div>

      {/* Unavailable Dates Dialog */}
      <Dialog open={isUnavailableDialogOpen} onOpenChange={setIsUnavailableDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Unavailable Dates - {selectedDoctor?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select dates when this doctor cannot work:</Label>
              <Calendar
                mode="multiple"
                selected={currentSelectedDates.length > 0 ? currentSelectedDates : computedSelectedDates}
                onSelect={(dates) => {
                  if (selectedDoctor) {
                    setSelectedDatesByDoctor(prev => ({
                      ...prev,
                      [selectedDoctor.id]: dates || []
                    }));
                  }
                }}
                className="rounded-md border mt-2"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleUpdateUnavailableDates}
                className="flex-1"
                disabled={updateUnavailableDatesMutation.isPending}
              >
                {updateUnavailableDatesMutation.isPending ? 'Saving...' : 'Save Changes'}
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
      <Dialog open={isShiftDetailsDialogOpen} onOpenChange={setIsShiftDetailsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Shift Details - {selectedDoctor?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedDoctor && (
              <div className="space-y-2">
                {getDoctorShifts(selectedDoctor.id).length > 0 ? (
                  getDoctorShifts(selectedDoctor.id).map((shift) => (
                    <div key={`${shift.date}-${shift.shiftType}`} className="flex justify-between items-center p-2 border rounded">
                      <span className="font-medium">
                        {format(new Date(shift.date), 'MMM d, yyyy')}
                      </span>
                      <span className="text-sm text-muted-foreground capitalize">
                        {shift.shiftType === '17shift' ? '17 Shift' : '20 Shift'}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    No shifts assigned yet.
                  </p>
                )}
              </div>
            )}
            <Button
              variant="outline"
              onClick={() => setIsShiftDetailsDialogOpen(false)}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
