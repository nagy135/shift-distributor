"use client"

import React from 'react'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Doctor, Shift } from '@/lib/api'
import { SHIFT_LABELS, SHIFT_TYPES, isWeekendOnly } from '@/lib/shifts'
import { getDay } from 'date-fns'
import { Pill } from '@/components/ui/pill'
import { cn } from '@/lib/utils'

interface ShiftAssignmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: Date | undefined
  doctors: Doctor[]
  getShiftForType: (shiftType: string) => Shift | undefined
  onAssign: (shiftType: string, doctorId: number | null) => Promise<void>
  unavailableByDoctor?: Record<number, Set<string>>
}

export function ShiftAssignmentModal({
  open,
  onOpenChange,
  date,
  doctors,
  getShiftForType,
  onAssign,
  unavailableByDoctor = {},
}: ShiftAssignmentModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Shifts {date ? `- ${format(date, 'MMM d, yyyy')}` : ''}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {SHIFT_TYPES.map((t) => {
            const disabledByWeekend = date ? (isWeekendOnly(t) && !([0, 6].includes(getDay(date)))) : false
            if (disabledByWeekend) return null
            return (
              <div key={t} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-sm">{SHIFT_LABELS[t]}</h3>
                  </div>
                  <div>
                    <Select
                      defaultValue={(() => {
                        const s = getShiftForType(t)
                        return s && s.doctorId != null ? String(s.doctorId) : 'none'
                      })()}
                      onValueChange={(value) => onAssign(t, value === 'none' ? null : parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a doctor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No doctor</SelectItem>
                        {doctors.map((doctor) => {
                          const dateKey = date ? format(date, 'yyyy-MM-dd') : null
                          const hasConflict = dateKey ? (unavailableByDoctor[doctor.id]?.has(dateKey) ?? false) : false
                          return (
                            <SelectItem key={doctor.id} value={doctor.id.toString()}>
                              <Pill
                                color={doctor.color || undefined}
                                showX={hasConflict}
                                className={cn('text-xs px-2 py-0')}
                              >
                                {doctor.name}
                              </Pill>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )
          })}

          <Button onClick={() => onOpenChange(false)} className="w-full border-2 border-green-200">
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}


