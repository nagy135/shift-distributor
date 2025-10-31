"use client"

import React from 'react'
import { eachDayOfInterval, endOfMonth, format, startOfMonth } from 'date-fns'
import type { Shift, Doctor } from '@/lib/api'
import { SHIFT_LABELS, SHIFT_TYPES, isWeekendOnly, type ShiftType } from '@/lib/shifts'
import { Pill } from '@/components/ui/pill'
import { cn } from '@/lib/utils'

interface MonthlyShiftTableProps {
  month: Date
  shifts: Shift[]
  doctors: Doctor[]
  unavailableByDoctor?: Record<number, Set<string>>
  onRowClick: (date: Date) => void
}

export function MonthlyShiftTable({ month, shifts, doctors, unavailableByDoctor = {}, onRowClick }: MonthlyShiftTableProps) {
  const days = React.useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  }, [month])

  const shiftIndex = React.useMemo(() => {
    const map = new Map<string, Partial<Record<ShiftType, Shift>>>()
    for (const s of shifts) {
      const byType = map.get(s.date) ?? {}
      byType[s.shiftType as ShiftType] = s
      map.set(s.date, byType)
    }
    return map
  }, [shifts])

  // Helper function to check if a shift assignment violates constraints
  const hasDoctorConflict = React.useCallback((doctorId: number, shift: Shift, date: string): boolean => {
    const hasDateConflict = unavailableByDoctor[doctorId]?.has(date) ?? false

    const doctor = doctors.find((d) => d.id === doctorId)
    const hasShiftTypeConflict = doctor?.unavailableShiftTypes && Array.isArray(doctor.unavailableShiftTypes)
      ? doctor.unavailableShiftTypes.includes(shift.shiftType as ShiftType)
      : false

    return hasDateConflict || hasShiftTypeConflict
  }, [doctors, unavailableByDoctor])

  const hasShiftConflict = React.useCallback((shift: Shift, date: string): boolean => {
    if (!Array.isArray(shift.doctorIds) || shift.doctorIds.length === 0) return false
    return shift.doctorIds.some((doctorId) => hasDoctorConflict(doctorId, shift, date))
  }
    , [hasDoctorConflict])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="overflow-x-auto rounded-md border">
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
                return s && hasShiftConflict(s, key)
              })
              // Hide weekend-only shift content on weekdays
              const day = d.getDay()
              const isWeekend = day === 0 || day === 6
              return (
                <tr
                  key={key}
                  className={cn(
                    "hover:bg-muted/30 cursor-pointer",
                    isWeekend && "bg-gray-100 dark:bg-gray-800",
                    rowConflict ? 'bg-red-100 dark:bg-red-900 hover:bg-red-200 border rounded border-red-400' : undefined
                  )}
                  onClick={() => onRowClick(d)}
                >
                  <td className="px-2 py-1 text-xs min-w-[100px]">{format(d, 'd. EEEE')}</td>
                  {SHIFT_TYPES.map((t) => {
                    const s = byType[t]
                    const showDash = isWeekendOnly(t) && !isWeekend
                    return (
                      <td key={t} className="px-2 py-1 text-center">
                        {showDash ? (
                          <span className="text-muted-foreground text-xs text-center block w-full">—</span>
                        ) : s ? (
                          s.doctorIds.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1 justify-center min-w-[120px]">
                              {s.doctors.map((assignedDoctor) => {
                                const conflict = hasDoctorConflict(assignedDoctor.id, s, key)
                                return (
                                  <Pill
                                    key={`${assignedDoctor.id}-${s.id}`}
                                    color={assignedDoctor.color || undefined}
                                    showX={conflict}
                                    className={cn('text-xs justify-center')}
                                  >
                                    {assignedDoctor.name}
                                  </Pill>
                                )
                              })}
                            </div>
                          ) : 'Unassigned'
                        ) : 'Unassigned'}
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


