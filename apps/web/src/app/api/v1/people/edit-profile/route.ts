import { NextRequest, NextResponse } from 'next/server';
import { createPeopleService, Person } from '@hypha-platform/core';

export async function POST(request: NextRequest) {
  try {
    const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the PeopleService using the factory method and pass the auth token
    const peopleService = createPeopleService({ authToken });

    // Get request body
    const body = await request.json();
    const { description, leadImageUrl, id } =
      body;

    // Note: id and slug will be handled by the repository
    const personData: Partial<Person> = {
      leadImageUrl,
      description,
      id
    };

    // Use the PeopleService to create the profile
    const updatedProfile = await peopleService.update(personData as Person);

    return NextResponse.json({ profile: updatedProfile }, { status: 201 });
  } catch (error) {
    console.error('Error editing profile:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
