"use client";

import {
  Calendar as CalendarIcon,
  Table as TableIcon,
  Download as DownloadIcon,
  Lock as LockIcon,
  Unlock as UnlockIcon,
  Loader2 as LoaderIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type CalendarHeaderActionsProps = {
  useTableView: boolean;
  onToggleView: () => void;
  onDistribute: () => void;
  onToggleLocked: () => void;
  onExport: () => void;
  isLocked: boolean;
  isDistributing: boolean;
  shiftsLoading: boolean;
  doctorsCount: number;
};

export function CalendarHeaderActions({
  useTableView,
  onToggleView,
  onDistribute,
  onToggleLocked,
  onExport,
  isLocked,
  isDistributing,
  shiftsLoading,
  doctorsCount,
}: CalendarHeaderActionsProps) {
  return (
    <>
      <Button
        variant="default"
        size="icon"
        onClick={onToggleView}
        className="lg:hidden"
        aria-label={
          useTableView ? "Switch to Calendar View" : "Switch to Table View"
        }
      >
        {useTableView ? (
          <CalendarIcon className="size-4" />
        ) : (
          <TableIcon className="size-4" />
        )}
      </Button>

      <Button
        variant="default"
        onClick={onToggleView}
        className="hidden lg:inline-flex"
      >
        {useTableView ? (
          <CalendarIcon className="size-4" />
        ) : (
          <TableIcon className="size-4" />
        )}
        <span className="ml-2">
          {useTableView ? "Calendar View" : "Table View"}
        </span>
      </Button>

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

      <Button variant="default" onClick={onExport} disabled={shiftsLoading}>
        <DownloadIcon className="size-4" />
        <span className="ml-1">Export</span>
      </Button>
    </>
  );
}
