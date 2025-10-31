"use client"

import React from 'react'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Doctor, Shift } from '@/lib/api'
import { SHIFT_LABELS, SHIFT_TYPES, isWeekendOnly, type ShiftType } from '@/lib/shifts'
import { getDay } from 'date-fns'
import { Pill } from '@/components/ui/pill'
import { cn } from '@/lib/utils'
import { MultiSelect } from '@/components/ui/multiselect'

interface ShiftAssignmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: Date | undefined
  doctors: Doctor[]
  getShiftForType: (shiftType: string) => Shift | undefined
  onAssign: (shiftType: string, doctorIds: number[]) => Promise<void>
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
  const [pendingAssignments, setPendingAssignments] = React.useState<Record<string, number[]>>({})

  const dateKey = React.useMemo(() => (date ? format(date, 'yyyy-MM-dd') : null), [date])

  React.useEffect(() => {
    if (!open) {
      return
    }

    const initial: Record<string, number[]> = {}
    SHIFT_TYPES.forEach((shiftType) => {
      const shift = getShiftForType(shiftType)
      initial[shiftType] = Array.isArray(shift?.doctorIds) ? [...shift.doctorIds] : []
    })
    setPendingAssignments(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dateKey])

  const updatePending = React.useCallback((shiftType: ShiftType, doctorIds: number[]) => {
    setPendingAssignments((prev) => ({
      ...prev,
      [shiftType]: doctorIds,
    }))
  }, [])

  const hasDoctorConflict = React.useCallback((doctorId: number, shiftType: ShiftType) => {
    if (!dateKey) return false
    const dateConflict = unavailableByDoctor[doctorId]?.has(dateKey) ?? false
    const doctor = doctors.find((d) => d.id === doctorId)
    const shiftTypeConflict = doctor?.unavailableShiftTypes && Array.isArray(doctor.unavailableShiftTypes)
      ? doctor.unavailableShiftTypes.includes(shiftType)
      : false
    return dateConflict || shiftTypeConflict
  }, [dateKey, doctors, unavailableByDoctor])

  const handleSelectionChange = React.useCallback((shiftType: ShiftType, values: string[]) => {
    const uniqueIds = Array.from(new Set(values
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value))
    ))
    updatePending(shiftType, uniqueIds)
  }, [updatePending])

  const handleApply = async () => {
    if (!date) {
      onOpenChange(false)
      return
    }

    try {
      for (const shiftType of SHIFT_TYPES) {
        const isWeekendDisabled = isWeekendOnly(shiftType) && !([0, 6].includes(getDay(date)))
        if (isWeekendDisabled) {
          continue
        }
        const doctorIds = pendingAssignments[shiftType] ?? []
        await onAssign(shiftType, doctorIds)
      }
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to apply shift assignments', error)
    }
  }

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

            const shift = getShiftForType(t)
            const selectedDoctorIds = pendingAssignments[t] ?? []

            const options = doctors.map((doctor) => {
              return {
                value: doctor.id.toString(),
                label: doctor.name,
                color: doctor.color ?? undefined,
                hasConflict: hasDoctorConflict(doctor.id, t),
              }
            })

            return (
              <div key={t} className="p-3 border rounded-lg space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-medium text-sm">{SHIFT_LABELS[t]}</h3>
                  <MultiSelect
                    options={options}
                    selected={selectedDoctorIds.map((id) => id.toString())}
                    onChange={(values) => handleSelectionChange(t, values)}
                    placeholder="Select doctors..."
                    className="w-60"
                  />
                </div>
                {selectedDoctorIds.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedDoctorIds.map((doctorId) => {
                      const assignedDoctor =
                        shift?.doctors.find((doc) => doc.id === doctorId) ??
                        doctors.find((doc) => doc.id === doctorId)
                      if (!assignedDoctor) return null
                      return (
                        <Pill
                          key={`${assignedDoctor.id}-${t}`}
                          color={assignedDoctor.color || undefined}
                          showX={hasDoctorConflict(assignedDoctor.id, t)}
                          className={cn('text-xs')}
                        >
                          {assignedDoctor.name}
                        </Pill>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          <Button onClick={handleApply} className="w-full border-2 border-green-200">
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}


