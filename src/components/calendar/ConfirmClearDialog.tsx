"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 as LoaderIcon } from "lucide-react";

type ConfirmClearDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isLocked: boolean;
  isClearing: boolean;
};

export function ConfirmClearDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  isLocked,
  isClearing,
}: ConfirmClearDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{"Zuweisungen dieses Monats zurücksetzen"}</DialogTitle>
          <DialogDescription>
            Alle Dienste im ausgewählten Monat werden auf „Nicht zugewiesen“
            gesetzt. Diese Aktion kann nicht rückgängig gemacht werden.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <div className="flex flex-col items-center items-stretch gap-2">
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isLocked || isClearing}
              aria-busy={isClearing}
            >
              {isClearing ? (
                <LoaderIcon className="size-4 animate-spin" />
              ) : (
                "Zurücksetzen"
              )}
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Abbrechen
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
