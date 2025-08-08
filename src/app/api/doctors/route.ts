import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { doctors, unavailableDates } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';


export async function GET() {
  try {
    const allDoctors = await db.select().from(doctors);
    return NextResponse.json(allDoctors);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    return NextResponse.json({ error: 'Failed to fetch doctors' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, color, unavailableDates: unavailableDatesList } = await request.json();
    
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Insert the doctor
    const [newDoctor] = await db.insert(doctors).values({ name, color }).returning();
    
    // Insert unavailable dates if provided
    if (unavailableDatesList && unavailableDatesList.length > 0) {
      const unavailableDatesToInsert = unavailableDatesList.map((date: string) => ({
        doctorId: newDoctor.id,
        date,
      }));
      
      await db.insert(unavailableDates).values(unavailableDatesToInsert);
    }

    return NextResponse.json(newDoctor, { status: 201 });
  } catch (error) {
    console.error('Error creating doctor:', error);
    return NextResponse.json({ error: 'Failed to create doctor' }, { status: 500 });
  }
} 

export async function PATCH(request: NextRequest) {
  try {
    const { id, color, name } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Doctor id is required' }, { status: 400 });
    }
    const updateValues: Record<string, unknown> = {};
    if (typeof color !== 'undefined') {
      updateValues.color = color;
    }
    if (typeof name !== 'undefined') {
      updateValues.name = name;
    }
    const [updated] = await db.update(doctors).set(updateValues).where(eq(doctors.id, id)).returning();
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating doctor color:', error);
    return NextResponse.json({ error: 'Failed to update doctor' }, { status: 500 });
  }
}