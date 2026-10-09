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

    return NextResponse.json(
      {
        error: profileCreateErrorMessage(error),
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 400 },
    );
  }
}

function errorChainMessages(error: unknown): string[] {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error && current.message) {
      messages.push(current.message);
    } else if (typeof current === 'string' && current) {
      messages.push(current);
    }

    if (typeof current === 'object' && current && 'cause' in current) {
      current = (current as { cause?: unknown }).cause;
    } else {
      break;
    }
  }

  return messages;
}

function profileCreateErrorMessage(error: unknown): string {
  // Constraint names are matched server-side. Other cause text stays in the log.
  const combined = errorChainMessages(error).join('\n');

  if (combined.includes('people_slug_unique')) {
    return 'nickname_taken';
  }
  if (combined.includes('people_email_unique')) {
    return 'email_taken';
  }

  return 'profile_create_failed';
}
