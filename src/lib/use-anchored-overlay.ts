"use client";

import { useEffect, useState, type MutableRefObject, type RefObject } from "react";

type AnchoredOverlayPosition = {
  top: number;
  left: number;
  minWidth: number;
};

type UseAnchoredOverlayOptions<AnchorElement extends HTMLElement> = {
  anchorKey: string | null;
  anchorRefs: MutableRefObject<Map<string, AnchorElement>>;
  wrapperRef: RefObject<HTMLElement | null>;
  isEnabled: boolean;
  isMobile?: boolean;
  minWidth?: number;
  alignWithinViewport?: boolean;
  recalculateKey?: unknown;
  onRequestClose?: () => void;
};

export function useAnchoredOverlay<AnchorElement extends HTMLElement>({
  anchorKey,
  anchorRefs,
  wrapperRef,
  isEnabled,
  isMobile = false,
  minWidth = 280,
  alignWithinViewport = false,
  recalculateKey,
  onRequestClose,
}: UseAnchoredOverlayOptions<AnchorElement>) {
  const [position, setPosition] = useState<AnchoredOverlayPosition | null>(null);

  useEffect(() => {
    if (!isEnabled || !anchorKey) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const wrapper = wrapperRef.current;
      const anchor = anchorRefs.current.get(anchorKey);

      if (!wrapper || !anchor) {
        setPosition(null);
        return;
      }

      const wrapperRect = wrapper.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const desiredMinWidth = Math.max(anchorRect.width, minWidth);

      if (!alignWithinViewport) {
        setPosition({
          top: anchorRect.bottom - wrapperRect.top + 6,
          left: anchorRect.left - wrapperRect.left,
          minWidth: desiredMinWidth,
        });
        return;
      }

      const viewportPadding = 12;
      const wouldOverflowRight =
        anchorRect.left + desiredMinWidth > window.innerWidth - viewportPadding;
      const alignedLeft = wouldOverflowRight
        ? anchorRect.right - wrapperRect.left - desiredMinWidth
        : anchorRect.left - wrapperRect.left;
      const minLeft = viewportPadding - wrapperRect.left;
      const maxLeft =
        window.innerWidth - viewportPadding - desiredMinWidth - wrapperRect.left;

      setPosition({
        top: anchorRect.bottom - wrapperRect.top + 6,
        left: Math.min(Math.max(alignedLeft, minLeft), maxLeft),
        minWidth: desiredMinWidth,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("resize", updatePosition);
    };
  }, [
    alignWithinViewport,
    anchorKey,
    anchorRefs,
    isEnabled,
    minWidth,
    recalculateKey,
    wrapperRef,
  ]);

  useEffect(() => {
    if (!isEnabled || !anchorKey || isMobile || !onRequestClose) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) {
        return;
      }

      onRequestClose();
    };

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [anchorKey, isEnabled, isMobile, onRequestClose, wrapperRef]);

  return position;
}
