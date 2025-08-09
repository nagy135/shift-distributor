"use client"

import * as React from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: string | undefined
  showX?: boolean
}

export function Pill({ color, showX = false, className, children, ...props }: PillProps) {
  const borderColor = color || '#e5e7eb'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm',
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
      {showX && <X className="h-4 w-4 text-red-600" aria-hidden="true" />}
    </span>
  )
}


