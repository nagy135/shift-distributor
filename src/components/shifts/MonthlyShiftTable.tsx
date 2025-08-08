"use client"

import React from 'react'
import { eachDayOfInterval, endOfMonth, format, startOfMonth } from 'date-fns'
import type { Shift } from '@/lib/api'
import { SHIFT_LABELS } from '@/lib/shifts'
import { Pill } from '@/components/ui/pill'

interface MonthlyShiftTableProps {
  month: Date
  shifts: Shift[]
  onRowClick: (date: Date) => void
}

export function MonthlyShiftTable({ month, shifts, onRowClick }: MonthlyShiftTableProps) {
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
              <th className="text-left px-3 py-2">{SHIFT_LABELS['17shift']}</th>
              <th className="text-left px-3 py-2">{SHIFT_LABELS['20shift']}</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const key = format(d, 'yyyy-MM-dd')
              const byType = shiftIndex.get(key) || {}
              const s17 = byType['17shift']
              const s20 = byType['20shift']
              return (
                <tr
                  key={key}
                  className="border-t hover:bg-muted/30 cursor-pointer"
                  onClick={() => onRowClick(d)}
                >
                  <td className="px-3 py-2 font-medium">{format(d, 'MMM d, yyyy')}</td>
                  <td className="px-3 py-2">
                    {s17?.doctorName ? <Pill color={s17.doctorColor}>{s17.doctorName}</Pill> : 'Unassigned'}
                  </td>
                  <td className="px-3 py-2">
                    {s20?.doctorName ? <Pill color={s20.doctorColor}>{s20.doctorName}</Pill> : 'Unassigned'}
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


