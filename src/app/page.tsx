"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle as AlertTriangleIcon } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
} from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { MonthSelector } from "@/components/MonthSelector";
import { ShiftAssignmentModal } from "@/components/shifts/ShiftAssignmentModal";
import type { QuickAssignOption } from "@/components/shifts/QuickAssignOverlay";
import { CalendarHeaderActions } from "@/components/calendar/CalendarHeaderActions";
import {
  CalendarContent,
  type CalendarTableView,
} from "@/components/calendar/CalendarContent";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportMonthTable } from "@/components/calendar/export-month-table";
import {
  getShiftForType,
  getShiftTargetKey,
  type CalendarCellClickOptions,
  type CalendarShiftTarget,
} from "@/components/calendar/utils";
import { useCalendarQueries } from "@/components/calendar/useCalendarQueries";
import { useMonthStore } from "@/lib/month-store";
import { useDistributeLockStore } from "@/lib/distribute-lock-store";
import { generateAssignmentsForMonth } from "@/lib/scheduler";
import { useMediaQuery } from "@/lib/use-media-query";
import {
  ALL_CALENDAR_SHIFT_TYPES,
  AUTO_DISTRIBUTE_SHIFT_TYPES,
  SHIFT_TYPES,
  doesCalendarShiftUnavailableDateClash,
  isDayDutyShiftType,
  isShiftType,
} from "@/lib/shifts";
import { useAuth } from "@/lib/auth-client";
import { useApiClient } from "@/lib/use-api-client";
import {
  canEditCalendarView,
  isAssigner,
  isShiftAssigner,
} from "@/lib/roles";

type ShiftAssignment = CalendarShiftTarget & {
  doctorIds: number[];
};

export default function CalendarPage() {
  const { user } = useAuth();
  const { shiftsApi, monthCalendarEmailsApi } = useApiClient();
  const [tableView, setTableView] = useState<CalendarTableView>("shifts");
  const canEditCurrentView = canEditCalendarView(user?.role, tableView);
  const canManageMonthPublication = isAssigner(user?.role);
  const canToggleSharedLock = isAssigner(user?.role);
  const canDistribute = isShiftAssigner(user?.role) && tableView === "shifts";
  const isDoctor = user?.role === "doctor";
  const isDesktopQuickAssign = useMediaQuery("(min-width: 768px)");
  const assignmentMode = isDesktopQuickAssign ? "quick" : "slow";
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const { month } = useMonthStore();
  const [isDistributing, setIsDistributing] = useState(false);
  const [isSendingCalendars, setIsSendingCalendars] = useState(false);
  const [isDistributeConfirmOpen, setIsDistributeConfirmOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isQuickAssignOpen, setIsQuickAssignOpen] = useState(false);
  const [isSelectionInteractionActive, setIsSelectionInteractionActive] =
    useState(false);
  const [quickAssignSearchTerm, setQuickAssignSearchTerm] = useState("");
  const [quickAssignHighlightedIndex, setQuickAssignHighlightedIndex] =
    useState(0);
  const [quickAssignDoctorIds, setQuickAssignDoctorIds] = useState<string[]>([]);
  const [quickAssignShowAvailableOnly, setQuickAssignShowAvailableOnly] =
    useState(false);
  const [selectedShiftType, setSelectedShiftType] = useState<string | null>(
    null,
  );
  const [selectedShiftTypes, setSelectedShiftTypes] = useState<string[]>([
    ...SHIFT_TYPES,
  ]);
  const [selectedTargets, setSelectedTargets] = useState<CalendarShiftTarget[]>(
    [],
  );
  const { isLocked, toggleLocked } = useDistributeLockStore();
  const {
    doctors,
    allShifts,
    shiftsLoading,
    unavailableByDoctor,
    approvedVacationsByDate,
    manualApprovedVacationsByDate,
    automaticNightVacationsByDate,
    assignShiftMutation,
    invalidateShifts,
    monthPublication,
    monthPublicationLoading,
    updateMonthPublicationMutation,
  } = useCalendarQueries(month);
  const isMonthPublished = monthPublication.isPublished;
  const shouldHideCalendarForDoctor = isDoctor && !monthPublicationLoading && !isMonthPublished;

  const clearSelectedTargets = useCallback(() => {
    setSelectedTargets([]);
  }, []);

  const notifyLocked = useCallback(() => {
    toast.error("Tabelle ist gesperrt und kann nicht bearbeitet werden.");
  }, []);

  const closeQuickAssign = useCallback(() => {
    setIsQuickAssignOpen(false);
    setQuickAssignSearchTerm("");
    setQuickAssignHighlightedIndex(0);
    setQuickAssignDoctorIds((current) => (current.length === 0 ? current : []));
  }, []);

  const closeQuickAssignAndClearSelection = useCallback(() => {
    closeQuickAssign();
    clearSelectedTargets();
  }, [clearSelectedTargets, closeQuickAssign]);

  useEffect(() => {
    if (canEditCurrentView) {
      return;
    }

    setIsAssignModalOpen(false);
    setIsQuickAssignOpen(false);
    setIsSelectionInteractionActive(false);
    clearSelectedTargets();
  }, [canEditCurrentView, clearSelectedTargets]);

  const selectedCellKeys = useMemo(
    () => new Set(selectedTargets.map((target) => getShiftTargetKey(target))),
    [selectedTargets],
  );

  const selectedTargetsKey = useMemo(
    () => selectedTargets.map((target) => getShiftTargetKey(target)).join("|"),
    [selectedTargets],
  );

  const doctorById = useMemo(
    () => new Map(doctors.map((doctor) => [doctor.id, doctor])),
    [doctors],
  );

  const quickAssignOptions = useMemo<QuickAssignOption[]>(
    () => {
      const selectedTargetKeys = new Set(
        selectedTargets.map((target) => getShiftTargetKey(target)),
      );

      const isDoctorAllowed = (doctor: (typeof doctors)[number]) =>
        selectedTargets.every((target) =>
          target.shiftType === "oa" ? doctor.oa : !doctor.oa,
        );

      const isDoctorAssignedToTarget = (
        doctorId: number,
        target: CalendarShiftTarget,
      ) => {
        if (selectedTargetKeys.has(getShiftTargetKey(target))) {
          return true;
        }

        const shift = getShiftForType({
          date: target.date,
          shiftType: target.shiftType,
          allShifts,
        });

        return Array.isArray(shift?.doctorIds)
          ? shift.doctorIds.includes(doctorId)
          : false;
      };

      const hasDoctorConflict = (doctorId: number) => {
        const doctor = doctorById.get(doctorId);

        if (!doctor) {
          return false;
        }

        return selectedTargets.some((target) => {
          const dateKey = format(target.date, "yyyy-MM-dd");
          const dateConflict =
            tableView === "shifts" &&
            doesCalendarShiftUnavailableDateClash(target.shiftType)
            ? (unavailableByDoctor[doctorId]?.has(dateKey) ?? false)
            : false;
          const shiftTypeConflict =
            isShiftType(target.shiftType) &&
            doctor.unavailableShiftTypes &&
            Array.isArray(doctor.unavailableShiftTypes)
              ? doctor.unavailableShiftTypes.includes(target.shiftType)
              : false;
          const vacationConflict = (approvedVacationsByDate[dateKey] ?? []).includes(
            doctor.name,
          );
          const nightOverlapConflict =
            target.shiftType === "night"
              ? ALL_CALENDAR_SHIFT_TYPES.some(
                  (shiftType) =>
                    isDayDutyShiftType(shiftType) &&
                    isDoctorAssignedToTarget(doctorId, {
                      date: target.date,
                      shiftType,
                    }),
                )
              : isDayDutyShiftType(target.shiftType) &&
                isDoctorAssignedToTarget(doctorId, {
                  date: target.date,
                  shiftType: "night",
                });

          return (
            dateConflict ||
            shiftTypeConflict ||
            vacationConflict ||
            nightOverlapConflict
          );
        });
      };

      return doctors
        .filter((doctor) => !doctor.disabled)
        .filter(isDoctorAllowed)
        .map((doctor) => ({
          value: doctor.id.toString(),
          label: doctor.name,
          color: doctor.color ?? undefined,
          hasConflict: hasDoctorConflict(doctor.id),
        }));
    },
    [
      allShifts,
      approvedVacationsByDate,
      doctorById,
      doctors,
      selectedTargets,
      tableView,
      unavailableByDoctor,
    ],
  );

  const filteredQuickAssignOptions = useMemo(() => {
    const normalizedTerm = quickAssignSearchTerm.trim().toLowerCase();

    return quickAssignOptions.filter((doctor) => {
      if (quickAssignShowAvailableOnly && doctor.hasConflict) {
        return false;
      }

      return !normalizedTerm
        ? true
        : doctor.label.toLowerCase().includes(normalizedTerm);
    });
  }, [
    quickAssignOptions,
    quickAssignSearchTerm,
    quickAssignShowAvailableOnly,
  ]);

  useEffect(() => {
    const maxHighlightedIndex = Math.max(filteredQuickAssignOptions.length - 1, 0);

    if (quickAssignHighlightedIndex <= maxHighlightedIndex) {
      return;
    }

    setQuickAssignHighlightedIndex(maxHighlightedIndex);
  }, [filteredQuickAssignOptions.length, quickAssignHighlightedIndex]);

  const openAssignModalForSelection = useCallback(() => {
    if (!canEditCurrentView || selectedTargets.length === 0) return;
    if (isLocked) {
      notifyLocked();
      return;
    }
    setSelectedDate(undefined);
    setSelectedShiftType(null);
    setSelectedShiftTypes(
      Array.from(new Set(selectedTargets.map((target) => target.shiftType))),
    );
    setIsAssignModalOpen(true);
  }, [canEditCurrentView, isLocked, notifyLocked, selectedTargets]);

  useEffect(() => {
    if (
      assignmentMode !== "slow" ||
      !canEditCurrentView ||
      selectedTargets.length === 0 ||
      isAssignModalOpen
    ) {
      return;
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== "Control" && event.key !== "Meta") {
        return;
      }
      openAssignModalForSelection();
    };

    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    assignmentMode,
    canEditCurrentView,
    isAssignModalOpen,
    openAssignModalForSelection,
    selectedTargets.length,
  ]);

  useEffect(() => {
    if (
      canEditCurrentView &&
      assignmentMode === "quick" &&
      selectedTargets.length > 0 &&
      !isSelectionInteractionActive
    ) {
      setIsQuickAssignOpen(true);
      return;
    }

    closeQuickAssign();
  }, [
    assignmentMode,
    canEditCurrentView,
    closeQuickAssign,
    isSelectionInteractionActive,
    selectedTargets.length,
    selectedTargetsKey,
  ]);

  useEffect(() => {
    if (assignmentMode !== "quick" || selectedTargets.length === 0) {
      setQuickAssignDoctorIds((current) => (current.length === 0 ? current : []));
      return;
    }

    const currentDoctorLists = selectedTargets.map((target) => {
      const shift = getShiftForType({
        date: target.date,
        shiftType: target.shiftType,
        allShifts,
      });

      return Array.isArray(shift?.doctorIds)
        ? shift.doctorIds.map((doctorId) => doctorId.toString())
        : [];
    });

    const firstDoctorList = currentDoctorLists[0] ?? [];
    const hasSameAssignments = currentDoctorLists.every(
      (doctorIds) =>
        doctorIds.length === firstDoctorList.length &&
        doctorIds.every((doctorId, index) => doctorId === firstDoctorList[index]),
    );

    const nextDoctorIds = hasSameAssignments ? firstDoctorList : [];

    setQuickAssignDoctorIds((current) => {
      if (
        current.length === nextDoctorIds.length &&
        current.every((doctorId, index) => doctorId === nextDoctorIds[index])
      ) {
        return current;
      }

      return nextDoctorIds;
    });
  }, [allShifts, assignmentMode, selectedTargets]);

  const handleAssignModalOpenChange = useCallback(
    (open: boolean) => {
      setIsAssignModalOpen(open);
      if (!open) {
        clearSelectedTargets();
      }
    },
    [clearSelectedTargets],
  );

  const openAssignModalForDate = (
    date: Date,
    shiftTypes: readonly string[],
  ) => {
    if (!canEditCurrentView) return;
    if (isLocked) {
      notifyLocked();
      return;
    }
    closeQuickAssign();
    clearSelectedTargets();
    setSelectedDate(date);
    setSelectedShiftTypes([...shiftTypes]);
    setSelectedShiftType(null);
    setIsAssignModalOpen(true);
  };

  const openAssignModalForCell = (
    date: Date,
    shiftType: string,
    shiftTypes: readonly string[],
    options: CalendarCellClickOptions,
  ) => {
    if (!canEditCurrentView) return;
    if (isLocked) {
      notifyLocked();
      return;
    }

    void options;

    const nextTarget = { date, shiftType };
    const nextKey = getShiftTargetKey(nextTarget);
    const popupAnchorKey =
      selectedTargets.length > 0
        ? getShiftTargetKey(selectedTargets[selectedTargets.length - 1]!)
        : null;
    const isSingleSelectedTarget =
      selectedTargets.length === 1 &&
      getShiftTargetKey(selectedTargets[0]!) === nextKey;
    const isPopupAnchorTarget = popupAnchorKey === nextKey;

    if (assignmentMode === "quick") {
      if (isPopupAnchorTarget && isQuickAssignOpen) {
          closeQuickAssign();
          clearSelectedTargets();
          return;
      }

      if (isSingleSelectedTarget) {
        setIsQuickAssignOpen(true);
        return;
      }

      closeQuickAssign();
      setSelectedTargets([nextTarget]);
      return;
    }

    if (isSingleSelectedTarget && isAssignModalOpen) {
      setIsAssignModalOpen(false);
      clearSelectedTargets();
      return;
    }

    closeQuickAssign();
    setSelectedDate(date);
    setSelectedShiftTypes([...shiftTypes]);
    setSelectedShiftType(shiftType);
    setSelectedTargets([nextTarget]);
    setIsAssignModalOpen(true);
  };

  const handleShiftAssignments = useCallback(
    async (assignments: ShiftAssignment[]) => {
      if (!canEditCurrentView) return;
      if (isLocked) {
        notifyLocked();
        return;
      }

      if (assignments.length === 0) return;

      const payload = assignments.map((assignment) => ({
        date: format(assignment.date, "yyyy-MM-dd"),
        shiftType: assignment.shiftType,
        doctorIds: assignment.doctorIds,
      }));

      try {
        if (payload.length === 1) {
          await assignShiftMutation.mutateAsync(payload[0]);
        } else {
          await shiftsApi.assignBatch(payload);
          await invalidateShifts();
        }
      } catch (error) {
        console.error("Error assigning shifts:", error);
      }
    },
    [
      assignShiftMutation,
      canEditCurrentView,
      invalidateShifts,
      isLocked,
      notifyLocked,
      shiftsApi,
    ],
  );

  const applyQuickAssignDoctorIds = useCallback(
    async (doctorIds: readonly string[]) => {
      if (isLocked) {
        notifyLocked();
        return;
      }

      if (!canEditCurrentView || selectedTargets.length === 0) {
        return;
      }

      const parsedDoctorIds = doctorIds
        .map((doctorId) => Number(doctorId))
        .filter((doctorId) => Number.isInteger(doctorId));

      setQuickAssignDoctorIds([...doctorIds]);

      await handleShiftAssignments(
        selectedTargets.map((target) => ({
          ...target,
          doctorIds: parsedDoctorIds,
        })),
      );
    },
    [
      canEditCurrentView,
      handleShiftAssignments,
      isLocked,
      notifyLocked,
      selectedTargets,
    ],
  );

  const handleQuickAssignToggle = useCallback(
    async (doctorId: string) => {
      const nextDoctorIds = quickAssignDoctorIds.includes(doctorId)
        ? quickAssignDoctorIds.filter((entry) => entry !== doctorId)
        : [...quickAssignDoctorIds, doctorId];

      await applyQuickAssignDoctorIds(nextDoctorIds);
    },
    [applyQuickAssignDoctorIds, quickAssignDoctorIds],
  );

  const handleQuickAssignOptionClick = useCallback(
    async (doctorId: string, _additive: boolean) => {
      void _additive;
      await handleQuickAssignToggle(doctorId);
    },
    [
      handleQuickAssignToggle,
    ],
  );

  useEffect(() => {
    if (!isLocked) {
      return;
    }

    setIsAssignModalOpen(false);
    setIsQuickAssignOpen(false);
    setIsSelectionInteractionActive(false);
    clearSelectedTargets();
  }, [clearSelectedTargets, isLocked]);

  useEffect(() => {
    if (
      assignmentMode !== "quick" ||
      !canEditCurrentView ||
      selectedTargets.length === 0 ||
      isAssignModalOpen
    ) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      if (
        target?.closest(
          'input, textarea, select, button, [contenteditable="true"]',
        )
      ) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeQuickAssignAndClearSelection();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setIsQuickAssignOpen(true);
        setQuickAssignHighlightedIndex((current) =>
          filteredQuickAssignOptions.length === 0
            ? 0
            : Math.min(current + 1, filteredQuickAssignOptions.length - 1),
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setIsQuickAssignOpen(true);
        setQuickAssignHighlightedIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();

        const highlightedOption =
          filteredQuickAssignOptions[quickAssignHighlightedIndex];

        if (highlightedOption) {
          void handleQuickAssignToggle(highlightedOption.value);
          return;
        }

        setIsQuickAssignOpen(true);
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        setIsQuickAssignOpen(true);
        setQuickAssignHighlightedIndex(0);
        setQuickAssignSearchTerm((current) => current.slice(0, -1));
        return;
      }

      if (
        event.key.length !== 1 ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();
      setIsQuickAssignOpen(true);
      setQuickAssignHighlightedIndex(0);
      setQuickAssignSearchTerm((current) => current + event.key);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    assignmentMode,
    canEditCurrentView,
    closeQuickAssignAndClearSelection,
    filteredQuickAssignOptions,
    handleQuickAssignToggle,
    isAssignModalOpen,
    quickAssignHighlightedIndex,
    selectedTargets.length,
  ]);

  const handleDistributeMonth = useCallback(() => {
    if (!canDistribute || isDistributing) return;
    setIsDistributeConfirmOpen(true);
  }, [canDistribute, isDistributing]);

  const confirmDistributeMonth = async () => {
    if (!canDistribute) return;

    try {
      setIsDistributeConfirmOpen(false);
      setIsDistributing(true);
      const range = {
        start: startOfMonth(month),
        end: endOfMonth(month),
      };
      const dates = eachDayOfInterval(range);

      const unavailableDatesByDoctor = Object.fromEntries(
        doctors.map((doctor) => [
          doctor.id,
          new Set(unavailableByDoctor[doctor.id] ?? []),
        ]),
      ) as Record<number, Set<string>>;

      for (const shift of allShifts) {
        if (shift.shiftType !== "night") continue;
        if (!Array.isArray(shift.doctorIds) || shift.doctorIds.length === 0) {
          continue;
        }
        if (!isSameMonth(new Date(shift.date), month)) continue;
        for (const doctorId of shift.doctorIds) {
          if (!unavailableDatesByDoctor[doctorId]) {
            unavailableDatesByDoctor[doctorId] = new Set();
          }
          unavailableDatesByDoctor[doctorId].add(shift.date);
        }
      }

      const assignments = generateAssignmentsForMonth({
        dates,
        doctors,
        shiftTypes: AUTO_DISTRIBUTE_SHIFT_TYPES,
        unavailableDatesByDoctor,
      });

      // Use batch endpoint for all assignments in a single request
      await shiftsApi.assignBatch(assignments);

      // Ensure fresh data when done
      await invalidateShifts();
    } catch (err) {
      console.error("Distribution failed", err);
    } finally {
      setIsDistributing(false);
    }
  };

  const handleExportMonthTable = async () => {
    try {
      await exportMonthTable({ month, allShifts, tableView });
    } catch (error) {
      console.error("Export failed", error);
    }
  };

  const handleSendMonthCalendars = useCallback(async () => {
    if (!canToggleSharedLock || isSendingCalendars) {
      return;
    }

    const monthKey = format(month, "yyyy-MM");
    const monthLabel = format(month, "MMMM yyyy", { locale: de });
    const scopeLabel =
      tableView === "departments" ? "Stationskalender" : "Dienstkalender";

    try {
      setIsSendingCalendars(true);
      const result = await monthCalendarEmailsApi.send(monthKey, tableView);
      const messagePrefix =
        result.mode === "mock"
          ? `Mock-${scopeLabel}`
          : `${scopeLabel}-E-Mails`;

      if (result.deliveredCount === 0) {
        toast.error(
          `${messagePrefix} fuer ${monthLabel} konnten nicht erstellt werden.`,
        );
        return;
      }

      toast.success(
        `${messagePrefix} fuer ${monthLabel}: ${result.deliveredCount} erstellt${result.skippedCount > 0 ? `, ${result.skippedCount} uebersprungen` : ""}.`,
      );
    } catch (error) {
      console.error("Error sending month calendar emails:", error);
      toast.error("Kalender-E-Mails konnten nicht erstellt werden.");
    } finally {
      setIsSendingCalendars(false);
    }
  }, [
    canToggleSharedLock,
    isSendingCalendars,
    month,
    monthCalendarEmailsApi,
    tableView,
  ]);

  const handleTogglePublished = useCallback(async () => {
    if (!canManageMonthPublication || updateMonthPublicationMutation.isPending) {
      return;
    }

    const nextPublished = !isMonthPublished;

    try {
      await updateMonthPublicationMutation.mutateAsync(nextPublished);
      toast.success(
        nextPublished
          ? "Monat wurde veroeffentlicht."
          : "Veroeffentlichung wurde zurueckgezogen.",
      );
    } catch (error) {
      console.error("Error updating month publication:", error);
      toast.error("Veroeffentlichung konnte nicht aktualisiert werden.");
    }
  }, [
    canManageMonthPublication,
    isMonthPublished,
    updateMonthPublicationMutation,
  ]);

  return (
    <div className="space-y-6">
      <MonthSelector
        rightActions={
          <CalendarHeaderActions
            onDistribute={handleDistributeMonth}
            onToggleLocked={toggleLocked}
            onSendCalendars={() => {
              void handleSendMonthCalendars();
            }}
            sendCalendarsLabel={
              tableView === "departments"
                ? "Stationskalender senden"
                : "Dienstkalender senden"
            }
            onTogglePublished={() => {
              void handleTogglePublished();
            }}
            onExport={handleExportMonthTable}
            isLocked={isLocked}
            isPublished={isMonthPublished}
            isDistributing={isDistributing}
            isSendingCalendars={isSendingCalendars}
            isPublishUpdating={updateMonthPublicationMutation.isPending}
            shiftsLoading={shiftsLoading}
            doctorsCount={doctors.length}
            showDistribute={canDistribute}
            showLockToggle={canToggleSharedLock}
            showSendCalendars={canToggleSharedLock}
            showPublishToggle={canManageMonthPublication}
          />
        }
      />

      {shouldHideCalendarForDoctor ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-6 text-amber-950">
          <div className="flex items-start gap-3">
            <AlertTriangleIcon className="mt-0.5 size-5 shrink-0" />
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">Monat noch nicht bereit</h2>
              <p className="text-sm">
                {`Der Dienstplan fuer ${format(month, "MMMM yyyy", { locale: de })} ist noch nicht veroeffentlicht.`}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <CalendarContent
          month={month}
          tableView={tableView}
          onTableViewChange={setTableView}
          shiftsLoading={shiftsLoading}
          doctors={doctors}
          allShifts={allShifts}
          unavailableByDoctor={unavailableByDoctor}
          approvedVacationsByDate={approvedVacationsByDate}
          manualApprovedVacationsByDate={manualApprovedVacationsByDate}
          automaticNightVacationsByDate={automaticNightVacationsByDate}
          selectedTargets={selectedTargets}
          selectedCellKeys={selectedCellKeys}
          onRowClick={canEditCurrentView ? openAssignModalForDate : undefined}
          onCellClick={canEditCurrentView ? openAssignModalForCell : undefined}
          onSelectionChange={
            canEditCurrentView
              ? (targets) => {
                  if (isLocked) {
                    notifyLocked();
                    return;
                  }

                  setSelectedTargets(targets);
                }
              : undefined
          }
          onSelectionInteractionChange={
            canEditCurrentView ? setIsSelectionInteractionActive : undefined
          }
          quickAssignOpen={canEditCurrentView && assignmentMode === "quick" && isQuickAssignOpen}
          quickAssignFilterText={quickAssignSearchTerm}
          quickAssignHighlightedIndex={quickAssignHighlightedIndex}
          quickAssignOptions={quickAssignOptions}
          quickAssignSelectedValues={quickAssignDoctorIds}
          quickAssignShowAvailableOnly={quickAssignShowAvailableOnly}
          onQuickAssignOptionClick={(value, additive) => {
            void handleQuickAssignOptionClick(value, additive);
          }}
          onQuickAssignToggle={(value) => {
            void handleQuickAssignToggle(value);
          }}
          onQuickAssignClose={closeQuickAssignAndClearSelection}
          onQuickAssignHighlightChange={setQuickAssignHighlightedIndex}
          onQuickAssignShowAvailableOnlyChange={setQuickAssignShowAvailableOnly}
        />
      )}

      {/* Reusable shift assignment modal for table rows */}
      <ShiftAssignmentModal
        open={isAssignModalOpen && canEditCurrentView}
        onOpenChange={handleAssignModalOpenChange}
        date={selectedDate}
        targets={selectedTargets}
        doctors={doctors}
        getShift={(date, shiftType) =>
          getShiftForType({ date, shiftType, allShifts })
        }
        shiftTypes={selectedShiftTypes}
        focusShiftType={selectedShiftType}
        onAssign={handleShiftAssignments}
        unavailableByDoctor={unavailableByDoctor}
        considerUnavailableDates={tableView === "shifts"}
        approvedVacationsByDate={approvedVacationsByDate}
      />

      <Dialog
        open={isDistributeConfirmOpen && canDistribute}
        onOpenChange={setIsDistributeConfirmOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dienste verteilen?</DialogTitle>
            <DialogDescription>
              {`Die automatische Verteilung wird fuer ${format(month, "MMMM yyyy", { locale: de })} gestartet und kann bestehende Eintraege ueberschreiben.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDistributeConfirmOpen(false)}
              disabled={isDistributing}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={confirmDistributeMonth}
              disabled={isDistributing}
            >
              Verteilung starten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
