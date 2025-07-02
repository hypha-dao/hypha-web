import { NextRequest, NextResponse } from 'next/server';
import { createPeopleService, Person } from '@hypha-platform/core/server';

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
    const {
      name,
      surname,
      email,
      avatarUrl,
      description,
      location,
      nickname,
      leadImageUrl,
      address,
      links,
    } = body;

    if (!name || !surname || !nickname || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Prepare the person object with all required fields
    // Note: id and slug will be handled by the repository
    const personData: Partial<Person> = {
      name,
      surname,
      email,
      avatarUrl,
      leadImageUrl,
      description,
      location,
      nickname,
      address,
      links,
    };

    // Use the PeopleService to create the profile
    const newProfile = await peopleService.create(personData as Person);

    return NextResponse.json({ profile: newProfile }, { status: 201 });
  } catch (error) {
    console.error('Error creating profile:', error);

    let errorMessage = 'Failed to create profile';
    if (error instanceof Error) {
      if (error.message.includes('people_slug_unique')) {
        errorMessage =
          'Profile with this nickname already exists. Please choose a different one.';
      } else if (error.message.includes('people_email_unique')) {
        errorMessage = 'Profile with this email already exists.';
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 400 },
    );
  }
}
