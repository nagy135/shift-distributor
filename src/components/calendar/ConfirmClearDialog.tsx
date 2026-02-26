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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{"Reset this month's assignments"}</DialogTitle>
          <DialogDescription>
            This will set all shifts in the selected month to Unassigned. This
            action cannot be undone.
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
                "Reset"
              )}
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
