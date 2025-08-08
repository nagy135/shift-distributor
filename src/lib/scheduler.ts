import { format, isSameDay, subDays } from 'date-fns'
import type { Doctor } from '@/lib/api'
import { SHIFT_TYPES, type ShiftType } from '@/lib/shifts'

// ShiftType now comes from shared shifts constants

export interface GeneratedAssignment {
  date: string // yyyy-MM-dd
  shiftType: ShiftType
  doctorId: number | null
}

interface GenerateAssignmentsParams {
  dates: Date[]
  doctors: Doctor[]
  shiftTypes?: ReadonlyArray<ShiftType>
  /** Map of doctorId -> set of yyyy-MM-dd strings the doctor is UNAVAILABLE */
  unavailableDatesByDoctor?: Record<number, Set<string>>
}

/**
 * Generate balanced random assignments for the given dates and doctors.
 * Constraints:
 * - Try to balance total number of assignments per doctor
 * - Do not assign the same doctor to multiple shifts on the same day
 * - Avoid assigning a doctor on consecutive days when possible
 */
export function generateAssignmentsForMonth(params: GenerateAssignmentsParams): GeneratedAssignment[] {
  const { dates, doctors, shiftTypes = SHIFT_TYPES, unavailableDatesByDoctor } = params

  const assignments: GeneratedAssignment[] = []
  if (doctors.length === 0 || dates.length === 0) return assignments

  // Track how many shifts each doctor has been assigned
  const assignmentCount = new Map<number, number>()
  // Track last date assigned for consecutive-day avoidance
  const lastAssignedDate = new Map<number, Date>()

  for (const doctor of doctors) {
    assignmentCount.set(doctor.id, 0)
  }

  // Helper to sort doctors by current load, then random tiebreaker
  const getSortedDoctorIds = (seed: number): number[] => {
    const ids = doctors.map((d) => d.id)
    // Shuffle a copy for random tie-breaking
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1) + seed) % (i + 1)
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
    }
    return ids.sort((a, b) => {
      const ca = assignmentCount.get(a) ?? 0
      const cb = assignmentCount.get(b) ?? 0
      if (ca !== cb) return ca - cb
      // Stable-ish due to prior shuffle
      return 0
    })
  }

  for (const date of dates) {
    const dayAssignments: number[] = []

    for (let sIdx = 0; sIdx < shiftTypes.length; sIdx++) {
      const shiftType = shiftTypes[sIdx]

      const candidateIds = getSortedDoctorIds(date.getDate() + sIdx)
      let chosen: number | null = null

      for (const candidateId of candidateIds) {
        // Cannot assign same doctor twice on same day
        if (dayAssignments.includes(candidateId)) continue

        // Respect unavailable dates
        if (unavailableDatesByDoctor) {
          const set = unavailableDatesByDoctor[candidateId]
          if (set && set.has(format(date, 'yyyy-MM-dd'))) {
            continue
          }
        }

        // Avoid consecutive days when possible
        const lastDate = lastAssignedDate.get(candidateId)
        if (lastDate && (isSameDay(subDays(date, 1), lastDate) || isSameDay(subDays(date, -1), lastDate))) {
          // skip candidate if they worked the day before or after (after shouldn't happen yet, but kept symmetric)
          continue
        }

        chosen = candidateId
        break
      }

      // If no candidate fits the consecutive-day constraint, relax it but still avoid same day double assignment
      if (chosen == null) {
        for (const candidateId of candidateIds) {
          if (dayAssignments.includes(candidateId)) continue
          // Still respect unavailable dates when relaxing
          if (unavailableDatesByDoctor) {
            const set = unavailableDatesByDoctor[candidateId]
            if (set && set.has(format(date, 'yyyy-MM-dd'))) {
              continue
            }
          }
          chosen = candidateId
          break
        }
      }

      assignments.push({
        date: format(date, 'yyyy-MM-dd'),
        shiftType,
        doctorId: chosen ?? null,
      })

      if (chosen != null) {
        dayAssignments.push(chosen)
        assignmentCount.set(chosen, (assignmentCount.get(chosen) ?? 0) + 1)
        lastAssignedDate.set(chosen, date)
      }
    }
  }

  return assignments
}


