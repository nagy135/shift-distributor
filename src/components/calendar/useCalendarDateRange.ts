"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  calendarDateRange,
  datesInCalendarRange,
  type CalendarDateRange,
} from "@/lib/calendar-date-range";
import { isDateKey } from "@/lib/dates";

interface Options {
  enabled: boolean;
  onDragStart: () => void;
  onSelectRange: (dates: string[], end: string) => void;
}

// Delegation keeps a drag alive when DayPicker replaces its day buttons during a preview.
export function useCalendarDateRange(options: Options) {
  const gridRef = useRef<HTMLDivElement>(null);
  const latest = useRef(options);
  const gesture = useRef<{
    pointerId: number;
    anchor: string;
    end: string;
    dragged: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const [previewRange, setPreviewRange] = useState<CalendarDateRange | null>(
    null,
  );

  useEffect(() => {
    latest.current = options;
    if (!options.enabled) {
      gesture.current = null;
      setPreviewRange(null);
    }
  }, [options]);

  useEffect(() => {
    const dateAtPoint = (event: PointerEvent) => {
      const button = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLButtonElement>("button[data-range-date]");
      const date = button?.dataset.rangeDate;
      return button &&
        !button.disabled &&
        gridRef.current?.contains(button) &&
        isDateKey(date)
        ? date
        : null;
    };
    const cancel = () => {
      if (gesture.current?.dragged) suppressClick.current = true;
      gesture.current = null;
      setPreviewRange(null);
    };
    const move = (event: PointerEvent) => {
      const current = gesture.current;
      if (
        !current ||
        current.pointerId !== event.pointerId ||
        !latest.current.enabled
      )
        return;
      const end = dateAtPoint(event);
      if (!end || current.end === end) return;
      if (!current.dragged) latest.current.onDragStart();
      current.dragged = true;
      current.end = end;
      event.preventDefault();
      setPreviewRange(calendarDateRange(current.anchor, end));
    };
    const finish = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current || current.pointerId !== event.pointerId) return;
      // The release position is authoritative even if the browser skipped a move event.
      move(event);
      const end = dateAtPoint(event);
      const dragged = current.dragged;
      gesture.current = null;
      setPreviewRange(null);
      if (!dragged) return;
      suppressClick.current = true;
      event.preventDefault();
      if (end && latest.current.enabled)
        latest.current.onSelectRange(
          datesInCalendarRange(calendarDateRange(current.anchor, end)),
          end,
        );
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", finish, true);
    document.addEventListener("pointercancel", cancel);
    document.addEventListener("keydown", keyDown);
    window.addEventListener("blur", cancel);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish, true);
      document.removeEventListener("pointercancel", cancel);
      document.removeEventListener("keydown", keyDown);
      window.removeEventListener("blur", cancel);
    };
  }, []);

  return {
    gridRef,
    previewRange,
    onPointerDownCapture: (event: ReactPointerEvent<HTMLDivElement>) => {
      suppressClick.current = false;
      if (!options.enabled || event.button !== 0 || !event.isPrimary) return;
      const button = (event.target as Element).closest<HTMLButtonElement>(
        "button[data-range-date]",
      );
      const date = button?.dataset.rangeDate;
      if (!button || button.disabled || !isDateKey(date)) return;
      gesture.current = {
        pointerId: event.pointerId,
        anchor: date,
        end: date,
        dragged: false,
      };
    },
    onClickCapture: (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!suppressClick.current || event.detail === 0) return;
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}
