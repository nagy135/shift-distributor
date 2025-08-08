"use client"

import * as React from 'react'
import { cn } from '@/lib/utils'

interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: string | null
}

export function Pill({ color, className, children, ...props }: PillProps) {
  const borderColor = color || '#e5e7eb' // default neutral
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-sm',
        className
      )}
      style={{
        borderColor,
        borderWidth: 3,
        borderStyle: 'solid',
        borderRadius: 9999,
      }}
      {...props}
    >
      {children}
    </span>
  )
}


