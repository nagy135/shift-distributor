"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: string | undefined;
  showX?: boolean;
}

export function Pill({
  color,
  showX = false,
  className,
  children,
  ...props
}: PillProps) {
  const markerColor = color || "#e5e7eb";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ backgroundColor: markerColor }}
      />
      {children}
      {showX && <X className="h-4 w-4 text-red-600" aria-hidden="true" />}
    </span>
  );
}
