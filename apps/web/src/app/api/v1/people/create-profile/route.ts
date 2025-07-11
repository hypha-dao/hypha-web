import { NextRequest, NextResponse } from 'next/server';
import { Person, schemaSignupPerson } from '@hypha-platform/core/client';
import { createPerson, getDb } from '@hypha-platform/core/server';

export async function POST(request: NextRequest) {
  try {
    const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const validationResult = schemaSignupPerson.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.format();
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 },
      );
    }

    const validatedData = validationResult.data;

    // Use the PeopleService to create the profile
    const newProfile = await createPerson(validatedData as Person, {
      db: getDb({ authToken }),
    });

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
