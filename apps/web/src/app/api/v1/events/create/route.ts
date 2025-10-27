import { schemaEvent, EventSchema } from '@hypha-platform/core/client';
import { createEvent, getDb } from '@hypha-platform/core/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const validationResult = schemaEvent.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.format();
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 },
      );
    }

    const validatedData = validationResult.data;

    const newEvent = await createEvent(validatedData as EventSchema, {
      db: getDb({ authToken }),
    });

    return NextResponse.json({ event: newEvent }, { status: 201 });
  } catch (error) {
    console.error('Error creating event:', error);

    return NextResponse.json(
      {
        error: 'Failed to create event',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 400 },
    );
  }
}
