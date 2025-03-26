import { NextRequest, NextResponse } from 'next/server';
import { createPeopleService, Person } from '@hypha-platform/core/server';
import { schemaEditPersonWeb2 } from '@core/people';

export async function POST(request: NextRequest) {
  try {
    const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();

    // Validate request body
    const validationResult = schemaEditPersonWeb2.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.format();
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 },
      );
    }

    const validatedData = validationResult.data;
    // Get the PeopleService using the factory method and pass the auth token
    const peopleService = createPeopleService({ authToken });
    const updatedProfile = await peopleService.update(validatedData as Person);

    return NextResponse.json({ profile: updatedProfile }, { status: 201 });
  } catch (error) {
    console.error('Error editing profile:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
