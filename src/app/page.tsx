"use client";

import {
  CalendarContent,
  type CalendarTableView,
} from "@/components/calendar/CalendarContent";
import { CalendarHeaderActions } from "@/components/calendar/CalendarHeaderActions";
import { exportMonthTable } from "@/components/calendar/export-month-table";
import { useCalendarQueries } from "@/components/calendar/useCalendarQueries";
import { useCalendarSelection } from "@/components/calendar/useCalendarSelection";
import {
  getShiftForType,
  getShiftTargetKey,
  type CalendarCellClickOptions,
  type CalendarShiftTarget,
} from "@/components/calendar/utils";
import { CalendarToolbar } from "@/components/calendar/CalendarToolbar";
import type { QuickAssignOption } from "@/components/shifts/QuickAssignOverlay";
import { ShiftAssignmentModal } from "@/components/shifts/ShiftAssignmentModal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MonthCalendarEmailResult } from "@/lib/api";
import { useAuth } from "@/lib/auth-client";
import { useDistributeLockStore } from "@/lib/distribute-lock-store";
import { useMonthStore } from "@/lib/month-store";
import { canEditCalendarView, isAssigner, isShiftAssigner } from "@/lib/roles";
import { generateAssignmentsForMonth } from "@/lib/scheduler";
import {
  getAssignmentConflicts,
  isDoctorEligible,
} from "@/lib/scheduling-rules";
import { AUTO_DISTRIBUTE_SHIFT_TYPES, SHIFT_TYPES } from "@/lib/shifts";
import { useApiClient } from "@/lib/use-api-client";
import { useMediaQuery } from "@/lib/use-media-query";
import { eachDayOfInterval, endOfMonth, format, startOfMonth } from "date-fns";
import { de } from "date-fns/locale";
import { AlertTriangle as AlertTriangleIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type ShiftAssignment = CalendarShiftTarget & {
  doctorIds: number[];
};

const getCalendarTableViewFromParam = (
  value: string | null,
): CalendarTableView => (value === "departments" ? "departments" : "shifts");

export default function CalendarPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { shiftsApi, monthCalendarEmailsApi } = useApiClient();
  const [tableView, setTableView] = useState<CalendarTableView>(() =>
    getCalendarTableViewFromParam(searchParams.get("type")),
  );
  const canEditCurrentView = canEditCalendarView(user?.role, tableView);
  const canManageMonthPublication = isAssigner(user?.role);
  const canToggleLocalLock = isAssigner(user?.role);
  const hasDistributionPermission =
    isShiftAssigner(user?.role) && tableView === "shifts";
  const isDoctor = user?.role === "doctor";
  const isDesktopQuickAssign = useMediaQuery("(min-width: 768px)");
  const assignmentMode = isDesktopQuickAssign ? "quick" : "slow";
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const { month } = useMonthStore();
  const [isDistributing, setIsDistributing] = useState(false);
  const [isSendingCalendars, setIsSendingCalendars] = useState(false);
  const [isSendCalendarsConfirmOpen, setIsSendCalendarsConfirmOpen] =
    useState(false);
  const [isSendCalendarsPreviewLoading, setIsSendCalendarsPreviewLoading] =
    useState(false);
  const [sendCalendarsPreview, setSendCalendarsPreview] =
    useState<MonthCalendarEmailResult | null>(null);
  const [isDistributeConfirmOpen, setIsDistributeConfirmOpen] = useState(false);
  const {
    selectedTargets,
    setSelectedTargets,
    isAssignModalOpen,
    setIsAssignModalOpen,
    isQuickAssignOpen,
    setIsQuickAssignOpen,
    isSelectionInteractionActive,
    setIsSelectionInteractionActive,
    setIsSavingAssignments,
  } = useCalendarSelection();
  const [quickAssignSearchTerm, setQuickAssignSearchTerm] = useState("");
  const [quickAssignHighlightedIndex, setQuickAssignHighlightedIndex] =
    useState(0);
  const [quickAssignDoctorIds, setQuickAssignDoctorIds] = useState<string[]>(
    [],
  );
  const [quickAssignShowAvailableOnly, setQuickAssignShowAvailableOnly] =
    useState(false);
  const [quickAssignShowOaDoctors, setQuickAssignShowOaDoctors] =
    useState(false);
  const [selectedShiftType, setSelectedShiftType] = useState<string | null>(
    null,
  );
  const [selectedShiftTypes, setSelectedShiftTypes] = useState<string[]>([
    ...SHIFT_TYPES,
  ]);
  const { isLocked, toggleLocked } = useDistributeLockStore();
  const {
    doctors,
    allShifts,
    shiftsLoading,
    dataError,
    vacationDoctorIdsByDate,
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
  const canDistribute =
    hasDistributionPermission && !shiftsLoading && !dataError;
  const getCalendarShift = useCallback(
    (date: Date, shiftType: string) =>
      getShiftForType({ date, shiftType, allShifts }),
    [allShifts],
  );
  const isMonthPublished = monthPublication.isPublished;
  const shouldHideCalendarForDoctor =
    isDoctor && !monthPublicationLoading && !isMonthPublished;

  const clearSelectedTargets = useCallback(() => {
    setSelectedTargets([]);
  }, [setSelectedTargets]);

  const notifyLocked = useCallback(() => {
    toast.error("Tabelle ist gesperrt und kann nicht bearbeitet werden.");
  }, []);

  const closeQuickAssign = useCallback(() => {
    setIsQuickAssignOpen(false);
    setQuickAssignSearchTerm("");
    setQuickAssignHighlightedIndex(0);
    setQuickAssignDoctorIds((current) => (current.length === 0 ? current : []));
    setQuickAssignShowOaDoctors(false);
  }, [setIsQuickAssignOpen]);

  const closeQuickAssignAndClearSelection = useCallback(() => {
    closeQuickAssign();
    clearSelectedTargets();
  }, [clearSelectedTargets, closeQuickAssign]);

  const closeSendCalendarsConfirm = useCallback(() => {
    setIsSendCalendarsConfirmOpen(false);
    setIsSendCalendarsPreviewLoading(false);
    setSendCalendarsPreview(null);
  }, []);

  useEffect(() => {
    const nextTableView = getCalendarTableViewFromParam(
      searchParams.get("type"),
    );

    setTableView((current) =>
      current === nextTableView ? current : nextTableView,
    );
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (params.get("type") === tableView) {
      return;
    }

    params.set("type", tableView);

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams, tableView]);

  useEffect(() => {
    if (canEditCurrentView) {
      return;
    }

    setIsAssignModalOpen(false);
    setIsQuickAssignOpen(false);
    closeSendCalendarsConfirm();
    setIsSelectionInteractionActive(false);
    clearSelectedTargets();
  }, [
    canEditCurrentView,
    clearSelectedTargets,
    closeSendCalendarsConfirm,
    setIsAssignModalOpen,
    setIsQuickAssignOpen,
    setIsSelectionInteractionActive,
  ]);

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
  const quickAssignOptions = useMemo<QuickAssignOption[]>(() => {
    const selectedTargetKeys = new Set(
      selectedTargets.map((target) => getShiftTargetKey(target)),
    );
    const selectedDoctorIds = new Set(
      quickAssignDoctorIds
        .map((doctorId) => Number(doctorId))
        .filter((doctorId) => Number.isInteger(doctorId)),
    );

    const isDoctorAllowed = (doctor: (typeof doctors)[number]) =>
      selectedTargets.every((target) =>
        isDoctorEligible(doctor, target.shiftType, quickAssignShowOaDoctors),
      );
    const proposedShifts = allShifts
      .filter(
        (shift) => !selectedTargetKeys.has(`${shift.date}|${shift.shiftType}`),
      )
      .concat(
        selectedTargets.map((target) => ({
          id: 0,
          version: 0,
          date: format(target.date, "yyyy-MM-dd"),
          shiftType: target.shiftType,
          doctorIds: [...selectedDoctorIds],
          doctors: [],
        })),
      );
    const hasDoctorConflict = (doctorId: number) => {
      const doctor = doctorById.get(doctorId);
      return (
        !!doctor &&
        selectedTargets.some(
          (target) =>
            getAssignmentConflicts(
              doctor,
              format(target.date, "yyyy-MM-dd"),
              target.shiftType,
              {
                shifts: proposedShifts,
                unavailableByDoctor,
                vacationDoctorIdsByDate,
              },
            ).length > 0,
        )
      );
    };

    return doctors
      .filter((doctor) => !doctor.disabled)
      .filter(
        (doctor) => isDoctorAllowed(doctor) || selectedDoctorIds.has(doctor.id),
      )
      .map((doctor) => ({
        value: doctor.id.toString(),
        label: doctor.name,
        color: doctor.color ?? undefined,
        hasConflict: hasDoctorConflict(doctor.id),
        oa: doctor.oa,
      }));
  }, [
    allShifts,
    vacationDoctorIdsByDate,
    doctorById,
    doctors,
    quickAssignDoctorIds,
    quickAssignShowOaDoctors,
    selectedTargets,
    unavailableByDoctor,
  ]);

  const quickAssignCanShowOaDoctors = useMemo(
    () => selectedTargets.some((target) => target.shiftType !== "oa"),
    [selectedTargets],
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
  }, [quickAssignOptions, quickAssignSearchTerm, quickAssignShowAvailableOnly]);

  useEffect(() => {
    const maxHighlightedIndex = Math.max(
      filteredQuickAssignOptions.length - 1,
      0,
    );

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
  }, [
    canEditCurrentView,
    isLocked,
    notifyLocked,
    selectedTargets,
    setIsAssignModalOpen,
  ]);

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
    setIsQuickAssignOpen,
  ]);

  useEffect(() => {
    if (assignmentMode !== "quick" || selectedTargets.length === 0) {
      setQuickAssignDoctorIds((current) =>
        current.length === 0 ? current : [],
      );
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
        doctorIds.every(
          (doctorId, index) => doctorId === firstDoctorList[index],
        ),
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
    [clearSelectedTargets, setIsAssignModalOpen],
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

  const assignmentInFlight = useRef(false);
  const handleShiftAssignments = useCallback(
    async (assignments: ShiftAssignment[]) => {
      if (!canEditCurrentView) throw new Error("Keine Berechtigung.");
      if (isLocked) {
        notifyLocked();
        throw new Error("Tabelle ist gesperrt.");
      }

      if (assignments.length === 0) return;
      if (assignmentInFlight.current)
        throw new Error("Bitte warten, bis der Dienst gespeichert ist.");
      assignmentInFlight.current = true;
      setIsSavingAssignments(true);

      const payload = assignments.map((assignment) => ({
        date: format(assignment.date, "yyyy-MM-dd"),
        shiftType: assignment.shiftType,
        doctorIds: assignment.doctorIds,
        expectedVersion:
          getShiftForType({
            date: assignment.date,
            shiftType: assignment.shiftType,
            allShifts,
          })?.version ?? 0,
      }));

      try {
        if (payload.length === 1) {
          await assignShiftMutation.mutateAsync(payload[0]);
        } else {
          await shiftsApi.assignBatch(payload);
          await invalidateShifts();
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Dienst konnte nicht gespeichert werden.",
        );
        throw error;
      } finally {
        assignmentInFlight.current = false;
        setIsSavingAssignments(false);
      }
    },
    [
      assignShiftMutation,
      allShifts,
      canEditCurrentView,
      invalidateShifts,
      isLocked,
      notifyLocked,
      shiftsApi,
      setIsSavingAssignments,
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

      const previousDoctorIds = quickAssignDoctorIds;
      setQuickAssignDoctorIds([...doctorIds]);

      try {
        await handleShiftAssignments(
          selectedTargets.map((target) => ({
            ...target,
            doctorIds: parsedDoctorIds,
          })),
        );
      } catch (error) {
        setQuickAssignDoctorIds(previousDoctorIds);
        throw error;
      }
    },
    [
      quickAssignDoctorIds,
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

      try {
        await applyQuickAssignDoctorIds(nextDoctorIds);
      } catch {
        /* The save handler displays the error. */
      }
    },
    [applyQuickAssignDoctorIds, quickAssignDoctorIds],
  );

  const handleQuickAssignOptionClick = useCallback(
    async (doctorId: string, _additive: boolean) => {
      void _additive;
      await handleQuickAssignToggle(doctorId);
    },
    [handleQuickAssignToggle],
  );

  useEffect(() => {
    if (!isLocked) {
      return;
    }

    setIsAssignModalOpen(false);
    setIsQuickAssignOpen(false);
    setIsSelectionInteractionActive(false);
    clearSelectedTargets();
  }, [
    clearSelectedTargets,
    isLocked,
    setIsAssignModalOpen,
    setIsQuickAssignOpen,
    setIsSelectionInteractionActive,
  ]);

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
    setIsQuickAssignOpen,
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

      const assignments = generateAssignmentsForMonth({
        dates,
        doctors,
        shiftTypes: AUTO_DISTRIBUTE_SHIFT_TYPES,
        unavailableDatesByDoctor,
        vacationDoctorIdsByDate,
        existingShifts: allShifts,
      });

      // Use batch endpoint for all assignments in a single request
      await shiftsApi.assignBatch(
        assignments.map((assignment) => ({
          ...assignment,
          expectedVersion:
            allShifts.find(
              (shift) =>
                shift.date === assignment.date &&
                shift.shiftType === assignment.shiftType,
            )?.version ?? 0,
        })),
      );

      // Ensure fresh data when done
      await invalidateShifts();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Verteilung fehlgeschlagen.",
      );
    } finally {
      setIsDistributing(false);
    }
  };

  const handleExportMonthTable = async () => {
    try {
      await exportMonthTable({
        month,
        allShifts,
        tableView,
        vacationColumnByDate:
          tableView === "departments"
            ? manualApprovedVacationsByDate
            : approvedVacationsByDate,
      });
    } catch (error) {
      console.error("Export failed", error);
    }
  };

  const handleSendMonthCalendars = useCallback(async () => {
    if (!canToggleLocalLock || isSendingCalendars || !sendCalendarsPreview) {
      return;
    }

    const monthKey = format(month, "yyyy-MM");
    const monthLabel = format(month, "MMMM yyyy", { locale: de });
    const scopeLabel =
      tableView === "departments" ? "Stationskalender" : "Dienstkalender";

    try {
      setIsSendCalendarsConfirmOpen(false);
      setIsSendingCalendars(true);
      const result = await monthCalendarEmailsApi.send(
        monthKey,
        tableView,
        sendCalendarsPreview!.revision,
      );
      const messagePrefix =
        result.mode === "mock" ? `Mock-${scopeLabel}` : `${scopeLabel}-E-Mails`;

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
    canToggleLocalLock,
    isSendingCalendars,
    month,
    monthCalendarEmailsApi,
    sendCalendarsPreview,
    tableView,
  ]);

  const handleOpenSendMonthCalendarsConfirm = useCallback(async () => {
    if (
      !canToggleLocalLock ||
      isSendingCalendars ||
      isSendCalendarsPreviewLoading
    ) {
      return;
    }

    const monthKey = format(month, "yyyy-MM");

    setIsSendCalendarsConfirmOpen(true);
    setIsSendCalendarsPreviewLoading(true);
    setSendCalendarsPreview(null);

    try {
      const preview = await monthCalendarEmailsApi.preview(monthKey, tableView);
      setSendCalendarsPreview(preview);
    } catch (error) {
      console.error("Error previewing month calendar emails:", error);
      toast.error("E-Mail-Vorschau konnte nicht geladen werden.");
      setIsSendCalendarsConfirmOpen(false);
    } finally {
      setIsSendCalendarsPreviewLoading(false);
    }
  }, [
    canToggleLocalLock,
    isSendingCalendars,
    isSendCalendarsPreviewLoading,
    month,
    monthCalendarEmailsApi,
    tableView,
  ]);

  const handleTogglePublished = useCallback(async () => {
    if (
      !canManageMonthPublication ||
      updateMonthPublicationMutation.isPending
    ) {
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
      <CalendarToolbar
        tableView={tableView}
        onTableViewChange={setTableView}
        showViewSwitch={!shouldHideCalendarForDoctor}
        actions={
          <CalendarHeaderActions
            onDistribute={handleDistributeMonth}
            onToggleLocked={toggleLocked}
            onSendCalendars={() => {
              void handleOpenSendMonthCalendarsConfirm();
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
            shiftsLoading={shiftsLoading || !!dataError}
            doctorsCount={doctors.length}
            showDistribute={canDistribute}
            showLockToggle={canToggleLocalLock}
            showSendCalendars={canToggleLocalLock}
            showPublishToggle={canManageMonthPublication}
          />
        }
      />

      {dataError && (
        <p className="text-destructive">
          Planungsdaten konnten nicht geladen werden. Bitte erneut laden.
        </p>
      )}
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
          shiftsLoading={shiftsLoading || !!dataError}
          doctors={doctors}
          allShifts={allShifts}
          unavailableByDoctor={unavailableByDoctor}
          approvedVacationsByDate={approvedVacationsByDate}
          vacationDoctorIdsByDate={vacationDoctorIdsByDate}
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
          quickAssignOpen={
            canEditCurrentView &&
            assignmentMode === "quick" &&
            isQuickAssignOpen
          }
          quickAssignFilterText={quickAssignSearchTerm}
          quickAssignHighlightedIndex={quickAssignHighlightedIndex}
          quickAssignOptions={quickAssignOptions}
          quickAssignSelectedValues={quickAssignDoctorIds}
          quickAssignShowAvailableOnly={quickAssignShowAvailableOnly}
          quickAssignShowOaDoctors={quickAssignShowOaDoctors}
          quickAssignCanShowOaDoctors={quickAssignCanShowOaDoctors}
          onQuickAssignOptionClick={(value, additive) => {
            void handleQuickAssignOptionClick(value, additive);
          }}
          onQuickAssignToggle={(value) => {
            void handleQuickAssignToggle(value);
          }}
          onQuickAssignClose={closeQuickAssignAndClearSelection}
          onQuickAssignHighlightChange={setQuickAssignHighlightedIndex}
          onQuickAssignShowAvailableOnlyChange={setQuickAssignShowAvailableOnly}
          onQuickAssignShowOaDoctorsChange={setQuickAssignShowOaDoctors}
        />
      )}

      {/* Reusable shift assignment modal for table rows */}
      <ShiftAssignmentModal
        open={isAssignModalOpen && canEditCurrentView}
        onOpenChange={handleAssignModalOpenChange}
        date={selectedDate}
        targets={selectedTargets}
        doctors={doctors}
        getShift={getCalendarShift}
        shiftTypes={selectedShiftTypes}
        focusShiftType={selectedShiftType}
        onAssign={handleShiftAssignments}
        unavailableByDoctor={unavailableByDoctor}
        vacationDoctorIdsByDate={vacationDoctorIdsByDate}
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

      <Dialog
        open={isSendCalendarsConfirmOpen && canToggleLocalLock}
        onOpenChange={(open) => {
          if (!open) {
            closeSendCalendarsConfirm();
            return;
          }

          setIsSendCalendarsConfirmOpen(true);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {tableView === "departments"
                ? "Stationskalender senden?"
                : "Dienstkalender senden?"}
            </DialogTitle>
            <DialogDescription>
              {`Es werden die Kalender fuer ${format(month, "MMMM yyyy", { locale: de })} wie folgt erstellt und versendet.`}
            </DialogDescription>
          </DialogHeader>

          {isSendCalendarsPreviewLoading ? (
            <div className="rounded-md border px-4 py-6 text-center text-sm text-muted-foreground">
              Vorschau wird geladen...
            </div>
          ) : sendCalendarsPreview ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-md border bg-muted/30 px-4 py-3">
                <p>
                  {`${sendCalendarsPreview.deliveredCount} E-Mails werden ${sendCalendarsPreview.mode === "mock" ? "als Mock-Dateien erstellt" : "per SMTP versendet"}.`}
                </p>
                <p className="text-muted-foreground">
                  {sendCalendarsPreview.skippedCount > 0
                    ? `${sendCalendarsPreview.skippedCount} Empfaenger werden uebersprungen.`
                    : "Es gibt keine uebersprungenen Empfaenger."}
                </p>
              </div>

              <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
                <div className="space-y-2">
                  <h3 className="font-medium">Wird gesendet an</h3>
                  {sendCalendarsPreview.deliveries.length > 0 ? (
                    <div className="rounded-md border">
                      {sendCalendarsPreview.deliveries.map((delivery) => (
                        <div
                          key={delivery.email}
                          className="flex items-start justify-between gap-3 border-b px-3 py-2 last:border-b-0"
                        >
                          <div>
                            <p className="font-medium">{delivery.doctorName}</p>
                            <p className="text-muted-foreground">
                              {delivery.email}
                            </p>
                          </div>
                          <p className="shrink-0 text-muted-foreground">
                            {delivery.shiftCount} Dienste
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md border px-3 py-2 text-muted-foreground">
                      Keine E-Mails zum Senden.
                    </div>
                  )}
                </div>

                {sendCalendarsPreview.skipped.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="font-medium">Wird uebersprungen</h3>
                    <div className="rounded-md border">
                      {sendCalendarsPreview.skipped.map((entry) => (
                        <div
                          key={`${entry.email}-${entry.reason}`}
                          className="border-b px-3 py-2 last:border-b-0"
                        >
                          <p className="font-medium">{entry.email}</p>
                          <p className="text-muted-foreground">
                            {entry.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-md border px-4 py-6 text-center text-sm text-muted-foreground">
              Keine Vorschau verfuegbar.
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeSendCalendarsConfirm}
              disabled={isSendingCalendars || isSendCalendarsPreviewLoading}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={() => {
                void handleSendMonthCalendars();
              }}
              disabled={
                isSendingCalendars ||
                isSendCalendarsPreviewLoading ||
                !sendCalendarsPreview ||
                sendCalendarsPreview.deliveredCount === 0
              }
            >
              Senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
