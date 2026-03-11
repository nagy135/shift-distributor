"use client";

import {
  Download as DownloadIcon,
  Lock as LockIcon,
  Unlock as UnlockIcon,
  Loader2 as LoaderIcon,
  Eye as PublishedIcon,
  EyeOff as UnpublishedIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type CalendarHeaderActionsProps = {
  onDistribute: () => void;
  onToggleLocked: () => void;
  onTogglePublished: () => void;
  onExport: () => void;
  isLocked: boolean;
  isPublished: boolean;
  isDistributing: boolean;
  isPublishUpdating: boolean;
  shiftsLoading: boolean;
  doctorsCount: number;
  showDistribute?: boolean;
  showLockToggle?: boolean;
  showPublishToggle?: boolean;
};

export function CalendarHeaderActions({
  onDistribute,
  onToggleLocked,
  onTogglePublished,
  onExport,
  isLocked,
  isPublished,
  isDistributing,
  isPublishUpdating,
  shiftsLoading,
  doctorsCount,
  showDistribute = true,
  showLockToggle = true,
  showPublishToggle = true,
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
          title={isLocked ? "Zum Verteilen entsperren" : undefined}
          className="relative"
          aria-busy={isDistributing}
        >
          <span className={isDistributing ? "opacity-0" : "opacity-100"}>
            Verteilen
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
            isLocked
              ? "Gesperrt. Zum Entsperren klicken"
              : "Entsperrt. Zum Sperren klicken"
          }
          title={isLocked ? "Gesperrt" : "Entsperrt"}
        >
          {isLocked ? (
            <LockIcon className="size-4" />
          ) : (
            <UnlockIcon className="size-4" />
          )}
        </Button>
      )}

      {showPublishToggle && (
        <Button
          variant="outline"
          size="icon"
          onClick={onTogglePublished}
          disabled={isPublishUpdating}
          aria-pressed={isPublished}
          aria-label={
            isPublished
              ? "Veroeffentlicht. Zum Zurueckziehen klicken"
              : "Nicht veroeffentlicht. Zum Veroeffentlichen klicken"
          }
          title={isPublished ? "Veroeffentlicht" : "Nicht veroeffentlicht"}
        >
          {isPublishUpdating ? (
            <LoaderIcon className="size-4 animate-spin" />
          ) : isPublished ? (
            <PublishedIcon className="size-4" />
          ) : (
            <UnpublishedIcon className="size-4" />
          )}
        </Button>
      )}

      <Button variant="default" onClick={onExport} disabled={shiftsLoading}>
        <DownloadIcon className="size-4" />
        <span className="ml-1">Exportieren</span>
      </Button>
    </>
  );
}
