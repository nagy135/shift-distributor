import React, { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Pill } from './pill';

export interface MultiSelectOption {
  value: string;
  label: string;
  color?: string | null;
  hasConflict?: boolean;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({ options, selected, onChange, placeholder = "Select items...", className }: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const optionsByValue = useMemo(() => {
    const map = new Map<string, MultiSelectOption>();
    for (const option of options) {
      map.set(option.value, option);
    }
    return map;
  }, [options]);

  const handleSelect = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter(item => item !== value)
      : [...selected, value];
    onChange(newSelected);
  };

  const handleRemove = (value: string) => {
    onChange(selected.filter(item => item !== value));
  };

  return (
    <div className={className}>
      <Popover modal={true} open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between min-h-10 h-auto"
          >
            <div className="flex flex-wrap gap-1 flex-1">
              {selected.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                selected.map((value) => {
                  const option = optionsByValue.get(value);
                  const label = option?.label ?? value;
                  const pillColor = option?.color ?? undefined;
                  const hasConflict = option?.hasConflict ?? false;
                  return (
                    <div key={value} className="flex items-center gap-1">
                      <Pill
                        color={pillColor || undefined}
                        showX={hasConflict}
                        className="text-xs px-2 py-0"
                      >
                        {label}
                      </Pill>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemove(value);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`Remove ${label}`}
                        className="hover:bg-secondary-foreground/20 rounded-full w-4 h-4 flex items-center justify-center cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <div className="max-h-60 overflow-auto">
            {options.map((option) => (
              <div
                key={option.value}
                className="flex items-center space-x-2 px-3 py-2 hover:bg-accent cursor-pointer"
                onClick={() => handleSelect(option.value)}
              >
                <div className="flex h-4 w-4 items-center justify-center border border-input rounded-sm">
                  {selected.includes(option.value) && (
                    <Check className="h-3 w-3 text-primary" />
                  )}
                </div>
                <Pill
                  color={option.color ?? undefined}
                  showX={option.hasConflict ?? false}
                  className="text-xs"
                >
                  {option.label}
                </Pill>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
