import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shifts, doctors } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

type ShiftRow = typeof shifts.$inferSelect;

interface ApiShift {
  id: number;
  date: string;
  shiftType: string;
  doctorIds: number[];
  doctors: Array<{ id: number; name: string; color: string | null }>;
}

const hydrateShifts = async (rows: ShiftRow[]): Promise<ApiShift[]> => {
  const doctorIdSet = new Set<number>();
  for (const row of rows) {
    for (const doctorId of row.doctorIds ?? []) {
      if (typeof doctorId === 'number') {
        doctorIdSet.add(doctorId);
      }
    }
  }

  const doctorMap = new Map<number, { id: number; name: string; color: string | null }>();
  if (doctorIdSet.size > 0) {
    const ids = Array.from(doctorIdSet);
    const doctorRows = await db
      .select({
        id: doctors.id,
        name: doctors.name,
        color: doctors.color,
      })
      .from(doctors)
      .where(inArray(doctors.id, ids));

    for (const doctor of doctorRows) {
      doctorMap.set(doctor.id, { id: doctor.id, name: doctor.name, color: doctor.color ?? null });
    }
  }

  return rows.map((row) => {
    const doctorIds = Array.isArray(row.doctorIds)
      ? row.doctorIds.filter((value): value is number => typeof value === 'number')
      : [];

    const doctorsForShift = doctorIds.map((doctorId) => {
      const doctor = doctorMap.get(doctorId)
      return doctor ?? { id: doctorId, name: `Doctor #${doctorId}`, color: null }
    })

    return {
      id: row.id,
      date: row.date,
      shiftType: row.shiftType,
      doctorIds,
      doctors: doctorsForShift,
    };
  });
};

const parseDoctorIds = (input: unknown): number[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  const ids = input
    .map((value) => {
      if (typeof value === 'number') {
        return value;
      }
      if (typeof value === 'string' && value.trim() !== '') {
        const numeric = Number(value);
        return Number.isNaN(numeric) ? null : numeric;
      }
      return null;
    })
    .filter((value): value is number => value != null && Number.isInteger(value));

  return Array.from(new Set(ids));
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    
    if (date) {
      const rows = await db
        .select()
        .from(shifts)
        .where(eq(shifts.date, date));

      const result = await hydrateShifts(rows);

      return NextResponse.json(result);
    } else {
      const rows = await db.select().from(shifts);
      const result = await hydrateShifts(rows);

      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('Error fetching shifts:', error);
    return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { date, shiftType, doctorIds } = await request.json();
    
    if (!date || !shiftType) {
      return NextResponse.json({ error: 'Date and shiftType are required' }, { status: 400 });
    }

    const normalizedDoctorIds = parseDoctorIds(doctorIds);

    // Check if a shift already exists for this date and type
    const existingShift = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.date, date), eq(shifts.shiftType, shiftType)));

    if (existingShift.length > 0) {
      const [updatedShift] = await db
        .update(shifts)
        .set({ doctorIds: normalizedDoctorIds })
        .where(eq(shifts.id, existingShift[0].id))
        .returning();

      const [hydrated] = await hydrateShifts([updatedShift]);

      return NextResponse.json(hydrated);
    } else {
      const [newShift] = await db
        .insert(shifts)
        .values({ date, shiftType, doctorIds: normalizedDoctorIds })
        .returning();

      const [hydrated] = await hydrateShifts([newShift]);

      return NextResponse.json(hydrated, { status: 201 });
    }
  } catch (error) {
    console.error('Error creating/updating shift:', error);
    return NextResponse.json({ error: 'Failed to create/update shift' }, { status: 500 });
  }
} 