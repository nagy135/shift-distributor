"use client";

import {
  Download as DownloadIcon,
  Lock as LockIcon,
  Unlock as UnlockIcon,
  Loader2 as LoaderIcon,
  Eye as PublishedIcon,
  EyeOff as UnpublishedIcon,
  Mail as MailIcon,
  Shuffle as DistributeIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const actionClassName =
  "relative h-12 min-w-0 flex-col gap-1 px-0 text-[10px] shadow-none min-[360px]:text-[11px] sm:h-9 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm";

type CalendarHeaderActionsProps = {
  onDistribute: () => void;
  onToggleLocked: () => void;
  onSendCalendars: () => void;
  sendCalendarsLabel: string;
  onTogglePublished: () => void;
  onExport: () => void;
  isLocked: boolean;
  isPublished: boolean;
  isDistributing: boolean;
  isSendingCalendars: boolean;
  isPublishUpdating: boolean;
  shiftsLoading: boolean;
  doctorsCount: number;
  showDistribute?: boolean;
  showLockToggle?: boolean;
  showSendCalendars?: boolean;
  showPublishToggle?: boolean;
};

export function CalendarHeaderActions({
  onDistribute,
  onToggleLocked,
  onSendCalendars,
  sendCalendarsLabel,
  onTogglePublished,
  onExport,
  isLocked,
  isPublished,
  isDistributing,
  isSendingCalendars,
  isPublishUpdating,
  shiftsLoading,
  doctorsCount,
  showDistribute = true,
  showLockToggle = true,
  showSendCalendars = true,
  showPublishToggle = true,
}: CalendarHeaderActionsProps) {
  return (
    <>
      {showDistribute && (
        <Button
          type="button"
          variant="outline"
          onClick={onDistribute}
          disabled={
            isLocked || isDistributing || shiftsLoading || doctorsCount === 0
          }
          title={isLocked ? "Zum Verteilen entsperren" : "Verteilen"}
          aria-label="Dienste automatisch verteilen"
          className={actionClassName}
          aria-busy={isDistributing}
        >
          <DistributeIcon
            aria-hidden="true"
            className={isDistributing ? "opacity-0" : "opacity-100"}
          />
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
          type="button"
          variant="outline"
          className={actionClassName}
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
          <span>{isLocked ? "Gesperrt" : "Entsperrt"}</span>
        </Button>
      )}

      {showSendCalendars && (
        <Button
          type="button"
          variant="outline"
          onClick={onSendCalendars}
          disabled={isSendingCalendars || shiftsLoading || doctorsCount === 0}
          title={sendCalendarsLabel}
          aria-label={sendCalendarsLabel}
          className={actionClassName}
          aria-busy={isSendingCalendars}
        >
          <MailIcon
            aria-hidden="true"
            className={isSendingCalendars ? "opacity-0" : "opacity-100"}
          />
          <span className={isSendingCalendars ? "opacity-0" : "opacity-100"}>
            <span className="sm:hidden">Senden</span>
            <span className="hidden sm:inline">{sendCalendarsLabel}</span>
          </span>
          {isSendingCalendars && (
            <span className="absolute inset-0 flex items-center justify-center">
              <LoaderIcon className="size-4 animate-spin" />
            </span>
          )}
        </Button>
      )}

      {showPublishToggle && (
        <Button
          type="button"
          variant="outline"
          className={actionClassName}
          onClick={onTogglePublished}
          disabled={isPublishUpdating}
          aria-pressed={isPublished}
          aria-busy={isPublishUpdating}
          aria-label={
            isPublished
              ? "Veröffentlicht. Zum Zurückziehen klicken"
              : "Nicht veröffentlicht. Zum Veröffentlichen klicken"
          }
          title={isPublished ? "Veröffentlicht" : "Nicht veröffentlicht"}
        >
          {isPublishUpdating ? (
            <LoaderIcon className="size-4 animate-spin" />
          ) : isPublished ? (
            <PublishedIcon className="size-4" />
          ) : (
            <UnpublishedIcon className="size-4" />
          )}
          <span className="sm:hidden">
            {isPublished ? "Öffentlich" : "Entwurf"}
          </span>
          <span className="hidden sm:inline">
            {isPublished ? "Veröffentlicht" : "Unveröffentlicht"}
          </span>
        </Button>
      )}

      <Button
        type="button"
        variant="default"
        className={actionClassName}
        onClick={onExport}
        disabled={shiftsLoading}
        title="Exportieren"
        aria-label="Kalender exportieren"
      >
        <DownloadIcon className="size-4" />
        <span className="sm:hidden">Export</span>
        <span className="hidden sm:inline">Exportieren</span>
      </Button>
    </>
  );
}
