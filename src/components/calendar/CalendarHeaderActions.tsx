"use client";

import {
  Download as DownloadIcon,
  Lock as LockIcon,
  Unlock as UnlockIcon,
  Loader2 as LoaderIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type CalendarHeaderActionsProps = {
  onDistribute: () => void;
  onToggleLocked: () => void;
  onExport: () => void;
  isLocked: boolean;
  isDistributing: boolean;
  shiftsLoading: boolean;
  doctorsCount: number;
  showDistribute?: boolean;
  showLockToggle?: boolean;
};

export function CalendarHeaderActions({
  onDistribute,
  onToggleLocked,
  onExport,
  isLocked,
  isDistributing,
  shiftsLoading,
  doctorsCount,
  showDistribute = true,
  showLockToggle = true,
}: CalendarHeaderActionsProps) {
  return (
    <>
      {showDistribute && (
        <Button
          variant="outline"
          onClick={onDistribute}
          disabled={
            isLocked || isDistributing || shiftsLoading || doctorsCount === 0
          }
          title={isLocked ? "Unlock to enable distribution" : undefined}
          className="relative"
          aria-busy={isDistributing}
        >
          <span className={isDistributing ? "opacity-0" : "opacity-100"}>
            Distribute
          </span>
          {isDistributing && (
            <span className="absolute inset-0 flex items-center justify-center">
              <LoaderIcon className="size-4 animate-spin" />
            </span>
          )}
        </Button>
      )}

      {showLockToggle && (
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleLocked}
          aria-pressed={!isLocked}
          aria-label={
            isLocked ? "Locked. Click to unlock" : "Unlocked. Click to lock"
          }
          title={isLocked ? "Locked" : "Unlocked"}
        >
          {isLocked ? (
            <LockIcon className="size-4" />
          ) : (
            <UnlockIcon className="size-4" />
          )}
        </Button>
      )}

      <Button variant="default" onClick={onExport} disabled={shiftsLoading}>
        <DownloadIcon className="size-4" />
        <span className="ml-1">Export</span>
      </Button>
    </>
  );
}
