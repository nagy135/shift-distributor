"use client"

import React from 'react'
import { eachDayOfInterval, endOfMonth, format, startOfMonth } from 'date-fns'
import type { Shift } from '@/lib/api'
import { SHIFT_LABELS, isWeekendOnly } from '@/lib/shifts'
import { Pill } from '@/components/ui/pill'
import { cn } from '@/lib/utils'

interface MonthlyShiftTableProps {
  month: Date
  shifts: Shift[]
  unavailableByDoctor?: Record<number, Set<string>>
  onRowClick: (date: Date) => void
}

export function MonthlyShiftTable({ month, shifts, unavailableByDoctor = {}, onRowClick }: MonthlyShiftTableProps) {
  const days = React.useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  }, [month])

  const shiftIndex = React.useMemo(() => {
    const map = new Map<string, { [key: string]: Shift | undefined }>()
    for (const s of shifts) {
      const byType = map.get(s.date) ?? {}
      byType[s.shiftType] = s
      map.set(s.date, byType)
    }
    return map
  }, [shifts])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
                          <tr>
                <th className="text-left px-3 py-2 w-40">Date</th>
                <th className="text-center px-3 py-2">{SHIFT_LABELS['17shift']}</th>
                <th className="text-center px-3 py-2">{SHIFT_LABELS['20shift']}</th>
              </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const key = format(d, 'yyyy-MM-dd')
              const byType = shiftIndex.get(key) || {}
              const s17 = byType['17shift']
              const s20 = byType['20shift']
              const conflict17 = s17?.doctorId != null && (unavailableByDoctor[s17.doctorId]?.has(key) ?? false)
              const conflict20 = s20?.doctorId != null && (unavailableByDoctor[s20.doctorId]?.has(key) ?? false)
              const rowConflict = conflict17 || conflict20
              // Hide weekend-only shift content on weekdays
              const day = d.getDay()
              const isWeekend = day === 0 || day === 6
              return (
                <tr
                  key={key}
                  className={cn(
                    "border-t hover:bg-muted/30 cursor-pointer",
                    isWeekend && "bg-gray-100"
                  )}
                  style={rowConflict ? { outline: '3px solid #ef4444', outlineOffset: -2 } : undefined}
                  onClick={() => onRowClick(d)}
                >
                  <td className="px-3 py-2 font-medium">{format(d, 'MMM d, yyyy')}</td>
                  <td className="px-3 py-2">
                    {isWeekend || !isWeekendOnly('17shift') ? (
                      s17?.doctorName ? (
                        <Pill color={s17.doctorColor || undefined} className={cn('min-w-[90px] justify-center', conflict17 ? 'bg-red-600 text-white' : undefined)}>
                          {s17.doctorName}
                        </Pill>
                      ) : 'Unassigned'
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isWeekendOnly('20shift') && !isWeekend ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      s20?.doctorName ? (
                        <Pill color={s20.doctorColor || undefined} className={cn('min-w-[90px] justify-center', conflict20 ? 'bg-red-600 text-white' : undefined)}>
                          {s20.doctorName}
                        </Pill>
                      ) : 'Unassigned'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}


