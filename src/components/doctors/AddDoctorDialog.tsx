"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AddDoctorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddDoctor: (name: string) => Promise<void>;
  isSaving: boolean;
};

export function AddDoctorDialog({
  open,
  onOpenChange,
  onAddDoctor,
  isSaving,
}: AddDoctorDialogProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
    }
  }, [open]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    await onAddDoctor(name.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Doctor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter doctor's name"
              autoComplete="off"
              onKeyPress={(event) => {
                if (event.key === "Enter") {
                  handleAdd();
                }
              }}
            />
          </div>
          <Button onClick={handleAdd} className="w-full" disabled={isSaving}>
            {isSaving ? "Adding..." : "Add Doctor"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
