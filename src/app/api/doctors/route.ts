import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { doctors, unavailableDates } from '@/lib/db/schema';


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
    const { name, unavailableDates: unavailableDatesList } = await request.json();
    
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Insert the doctor
    const [newDoctor] = await db.insert(doctors).values({ name }).returning();
    
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