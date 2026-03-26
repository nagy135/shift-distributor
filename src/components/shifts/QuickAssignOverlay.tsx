"use client";

import React from "react";
import { Check, Search, Trash2, X } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type QuickAssignOption = {
  value: string;
  label: string;
  color?: string | null;
  hasConflict?: boolean;
};

type QuickAssignOverlayProps = {
  open: boolean;
  position: {
    top: number;
    left: number;
    minWidth: number;
  } | null;
  options: readonly QuickAssignOption[];
  filterText: string;
  highlightedIndex: number;
  selectedValues: readonly string[];
  showAvailableOnly: boolean;
  onOptionClick: (value: string, additive: boolean) => void;
  onToggleSelect: (value: string) => void;
  onClose: () => void;
  onHighlightChange: (index: number) => void;
  onShowAvailableOnlyChange: (value: boolean) => void;
};

export function QuickAssignOverlay({
  open,
  position,
  options,
  filterText,
  highlightedIndex,
  selectedValues,
  showAvailableOnly,
  onOptionClick,
  onToggleSelect,
  onClose,
  onHighlightChange,
  onShowAvailableOnlyChange,
}: QuickAssignOverlayProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const filteredOptions = React.useMemo(() => {
    const normalizedTerm = filterText.trim().toLowerCase();

    return options.filter((option) => {
      if (showAvailableOnly && option.hasConflict) {
        return false;
      }

      return !normalizedTerm
        ? true
        : option.label.toLowerCase().includes(normalizedTerm);
    });
  }, [filterText, options, showAvailableOnly]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }

      onClose();
    };

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [onClose, open]);

  if (!open || !position) {
    return null;
  }

  const selectedCount = selectedValues.length;

  return (
    <div
      ref={containerRef}
      className="absolute z-30 w-72 overflow-hidden rounded-xl border border-border/60 bg-background shadow-2xl"
      style={{
        top: position.top,
        left: position.left,
        minWidth: Math.max(position.minWidth, 280),
      }}
    >
      {/* Search + filter bar */}
      <div className="px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm focus-within:border-sky-400 focus-within:ring-1 focus-within:ring-sky-400/30">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            {filterText ? (
              <span className="flex-1 truncate">{filterText}</span>
            ) : (
              <span className="flex-1 truncate text-muted-foreground">
                Tippen zum Filtern...
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground select-none">
          <Switch
            checked={showAvailableOnly}
            onCheckedChange={onShowAvailableOnlyChange}
            onMouseDown={(event) => event.preventDefault()}
            aria-label="Nur verfuegbare Aerzte anzeigen"
            className="scale-75"
          />
          <span>Nur verfuegbare anzeigen</span>
        </label>
      </div>

      {/* Selected doctors chips */}
      {selectedCount > 0 ? (
        <div className="border-b-2 border-border bg-muted/50 px-3 py-3 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.1)]">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Zugewiesen ({selectedCount})
          </div>
          <div className="flex flex-wrap gap-1">
            {selectedValues.map((value) => {
              const option = options.find((entry) => entry.value === value);

              if (!option) {
                return null;
              }

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onToggleSelect(value)}
                  className="group inline-flex cursor-pointer items-center gap-1 rounded-full border border-border/50 bg-muted/40 py-0.5 pl-1 pr-1.5 text-xs transition-colors hover:border-red-300 hover:bg-red-50 dark:hover:border-red-800 dark:hover:bg-red-950/40"
                >
                  <Pill
                    color={option.color ?? undefined}
                    showX={option.hasConflict ?? false}
                    className="text-xs"
                  >
                    {option.label}
                  </Pill>
                  <Trash2 className="size-3 text-muted-foreground group-hover:text-red-500" />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Options list */}
      <div className="max-h-56 overflow-auto py-1">
        {filteredOptions.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            Keine passenden Aerzte gefunden.
          </div>
        ) : (
          filteredOptions.map((option, index) => {
            const isSelected = selectedValues.includes(option.value);

            return (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors",
                  index === highlightedIndex && "bg-accent",
                  isSelected &&
                    index !== highlightedIndex &&
                    "bg-sky-50/60 dark:bg-sky-950/20",
                )}
                onMouseEnter={() => onHighlightChange(index)}
                onClick={(event) =>
                  onOptionClick(option.value, event.metaKey || event.ctrlKey)
                }
              >
                <div
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                    isSelected
                      ? "border-foreground bg-foreground text-background"
                      : "border-border",
                  )}
                >
                  {isSelected ? <Check className="size-3" /> : null}
                </div>
                <Pill
                  color={option.color ?? undefined}
                  showX={option.hasConflict ?? false}
                  className="flex-1 text-xs"
                >
                  {option.label}
                </Pill>
              </button>
            );
          })
        )}
      </div>

    </div>
  );
}
