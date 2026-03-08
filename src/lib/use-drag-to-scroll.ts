import React from "react";

type DragState = {
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
  moved: boolean;
};

const DRAG_THRESHOLD_PX = 8;

export function useDragToScroll<T extends HTMLElement>() {
  const containerRef = React.useRef<T | null>(null);
  const dragStateRef = React.useRef<DragState | null>(null);
  const suppressClickRef = React.useRef(false);
  const [isDragging, setIsDragging] = React.useState(false);

  const endDrag = React.useCallback(() => {
    dragStateRef.current = null;
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const container = containerRef.current;
      const dragState = dragStateRef.current;

      if (!container || !dragState) return;

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;

      if (
        !dragState.moved &&
        Math.abs(deltaX) < DRAG_THRESHOLD_PX &&
        Math.abs(deltaY) < DRAG_THRESHOLD_PX
      ) {
        return;
      }

      if (
        !dragState.moved &&
        container.scrollWidth <= container.clientWidth &&
        container.scrollHeight <= container.clientHeight
      ) {
        return;
      }

      dragState.moved = true;
      suppressClickRef.current = true;
      setIsDragging(true);
      container.scrollLeft = dragState.scrollLeft - deltaX;
      container.scrollTop = dragState.scrollTop - deltaY;
      event.preventDefault();
    };

    const handleMouseUp = () => {
      endDrag();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [endDrag]);

  const onMouseDown = React.useCallback((event: React.MouseEvent<T>) => {
    if (event.button !== 0) return;

    const container = containerRef.current;
    if (!container) return;

    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
      moved: false,
    };
    suppressClickRef.current = false;
  }, []);

  const onClickCapture = React.useCallback((event: React.MouseEvent<T>) => {
    if (!suppressClickRef.current) return;

    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const onDragStart = React.useCallback((event: React.DragEvent<T>) => {
    event.preventDefault();
  }, []);

  return {
    containerRef,
    isDragging,
    dragHandlers: {
      onMouseDown,
      onClickCapture,
      onDragStart,
    },
  };
}
