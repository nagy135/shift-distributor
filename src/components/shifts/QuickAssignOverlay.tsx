"use client";

import React from "react";
import { Check, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  onApply: () => void;
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
  onApply,
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

  return (
    <div
      ref={containerRef}
      className="absolute z-30 overflow-hidden rounded-lg border bg-background shadow-xl"
      style={{
        top: position.top,
        left: position.left,
        minWidth: Math.max(position.minWidth, 260),
      }}
    >
      <div className="border-b px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Schnellzuweisung
            </div>
            <div className="mt-1 text-sm">
              {filterText ? (
                <span>
                  Suche: <span className="font-medium">{filterText}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Tippen zum Filtern
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Enter wählt aus, Cmd/Ctrl+Enter übernimmt.
            </div>
          </div>

          <Button
            type="button"
            variant="default"
            size="sm"
            className="shrink-0"
            onClick={onApply}
            aria-label="Auswahl übernehmen"
            title="Auswahl übernehmen"
          >
            <span>Speichern</span>
            <Save className="size-4" />
          </Button>
        </div>
        <label className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
          <span>Alle</span>
          <Switch
            checked={showAvailableOnly}
            onCheckedChange={onShowAvailableOnlyChange}
            onMouseDown={(event) => event.preventDefault()}
            aria-label="Nur verfuegbare Aerzte anzeigen"
            className="scale-75"
          />
          <span>Verfuegbar</span>
        </label>
        {selectedValues.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
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
                  className="cursor-pointer rounded-full border border-border/70 bg-muted/50 px-1 py-0.5 transition-colors hover:bg-muted"
                >
                  <Pill
                    color={option.color ?? undefined}
                    showX={option.hasConflict ?? false}
                    className="inline-flex items-center gap-1 text-xs"
                  >
                    <span>{option.label}</span>
                    <Trash2 className="size-3" />
                  </Pill>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="max-h-64 overflow-auto p-1">
        {filteredOptions.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            Keine passenden AErzte gefunden.
          </div>
        ) : (
          filteredOptions.map((option, index) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                "flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent",
                index === highlightedIndex && "bg-accent",
                selectedValues.includes(option.value) && "bg-accent/70",
              )}
              onMouseEnter={() => onHighlightChange(index)}
              onClick={(event) =>
                onOptionClick(option.value, event.metaKey || event.ctrlKey)
              }
            >
              <Pill
                color={option.color ?? undefined}
                showX={option.hasConflict ?? false}
                className="text-xs"
              >
                {option.label}
              </Pill>
              <div className="flex items-center gap-2">
                {selectedValues.includes(option.value) ? (
                  <Check className="size-4" />
                ) : index === highlightedIndex ? (
                  <div className="size-4 rounded-full border" />
                ) : null}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
