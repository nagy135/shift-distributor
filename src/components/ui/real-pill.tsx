"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type RealPillProps = React.HTMLAttributes<HTMLSpanElement> & {
  color?: string;
};

export function RealPill({
  color,
  className,
  style,
  children,
  ...props
}: RealPillProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={{
        ...(color
          ? {
              backgroundColor: color,
            }
          : null),
        ...style,
      }}
      {...props}
    >
      {children}
    </span>
  );
}
