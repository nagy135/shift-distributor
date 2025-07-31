import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shifts, doctors } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    
    if (date) {
      // Get shifts for a specific date with doctor information
      const shiftsWithDoctors = await db
        .select({
          id: shifts.id,
          date: shifts.date,
          shiftType: shifts.shiftType,
          doctorId: shifts.doctorId,
          doctorName: doctors.name,
        })
        .from(shifts)
        .leftJoin(doctors, eq(shifts.doctorId, doctors.id))
        .where(eq(shifts.date, date));
      
      return NextResponse.json(shiftsWithDoctors);
    } else {
      // Get all shifts with doctor information
      const allShifts = await db
        .select({
          id: shifts.id,
          date: shifts.date,
          shiftType: shifts.shiftType,
          doctorId: shifts.doctorId,
          doctorName: doctors.name,
        })
        .from(shifts)
        .leftJoin(doctors, eq(shifts.doctorId, doctors.id));
      
      return NextResponse.json(allShifts);
    }
  } catch (error) {
    console.error('Error fetching shifts:', error);
    return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { date, shiftType, doctorId } = await request.json();
    
    if (!date || !shiftType) {
      return NextResponse.json({ error: 'Date and shiftType are required' }, { status: 400 });
    }

    // Check if a shift already exists for this date and type
    const existingShift = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.date, date), eq(shifts.shiftType, shiftType)));

    if (existingShift.length > 0) {
      // Update existing shift
      const [updatedShift] = await db
        .update(shifts)
        .set({ doctorId })
        .where(eq(shifts.id, existingShift[0].id))
        .returning();
      
      return NextResponse.json(updatedShift);
    } else {
      // Create new shift
      const [newShift] = await db
        .insert(shifts)
        .values({ date, shiftType, doctorId })
        .returning();
      
      return NextResponse.json(newShift, { status: 201 });
    }
  } catch (error) {
    console.error('Error creating/updating shift:', error);
    return NextResponse.json({ error: 'Failed to create/update shift' }, { status: 500 });
  }
} 