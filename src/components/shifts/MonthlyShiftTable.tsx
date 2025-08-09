"use client"

import React from 'react'
import { eachDayOfInterval, endOfMonth, format, startOfMonth } from 'date-fns'
import type { Shift } from '@/lib/api'
import { SHIFT_LABELS, SHIFT_TYPES, isWeekendOnly } from '@/lib/shifts'
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
              <th className="text-left px-2 py-1 w-40">Date</th>
              {SHIFT_TYPES.map((t) => (
                <th key={t} className="text-center px-2 py-1">{SHIFT_LABELS[t]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const key = format(d, 'yyyy-MM-dd')
              const byType = shiftIndex.get(key) || {}
              const rowConflict = SHIFT_TYPES.some((t) => {
                const s = byType[t]
                return s?.doctorId != null && (unavailableByDoctor[s.doctorId]?.has(key) ?? false)
              })
              // Hide weekend-only shift content on weekdays
              const day = d.getDay()
              const isWeekend = day === 0 || day === 6
              return (
                <tr
                  key={key}
                  className={cn(
                    "hover:bg-muted/30 cursor-pointer",
                    isWeekend && "bg-gray-100",
                    rowConflict ? 'bg-red-100 hover:bg-red-200 border rounded border-red-400' : undefined
                  )}
                  onClick={() => onRowClick(d)}
                >
                  <td className="px-2 py-1 text-xs min-w-[100px]">{format(d, 'd. EEEE')}</td>
                  {SHIFT_TYPES.map((t) => {
                    const s = byType[t]
                    const conflict = s?.doctorId != null && (unavailableByDoctor[s?.doctorId]?.has(key) ?? false)
                    const showDash = isWeekendOnly(t) && !isWeekend
                    return (
                      <td key={t} className="px-2 py-1 text-center">
                        {showDash ? (
                          <span className="text-muted-foreground text-xs text-center block w-full">—</span>
                        ) : (
                          s?.doctorName ? (
                            <div className="flex items-center gap-1 justify-center min-w-[90px]">
                              <Pill
                                color={s.doctorColor || undefined}
                                showX={conflict}
                                className={cn('text-xs justify-center')}
                              >
                                {s.doctorName}
                              </Pill>
                            </div>
                          ) : 'Unassigned'
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}


