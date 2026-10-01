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

/** Drop connection strings so a database failure can be shown in the UI. */
function sanitizeDatabaseMessage(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function profileCreateErrorMessage(error: unknown): string {
  const messages = errorChainMessages(error);
  const combined = messages.join('\n');

  if (combined.includes('people_slug_unique')) {
    return 'Profile with this nickname already exists. Please choose a different one.';
  }
  if (combined.includes('people_email_unique')) {
    return 'An account with this email already exists. Try signing in or use a different email.';
  }

  const databaseMessage = [...messages]
    .reverse()
    .find((message) => message && !message.startsWith('Failed query:'));
  const sanitized = databaseMessage
    ? sanitizeDatabaseMessage(databaseMessage)
    : '';

  return sanitized || 'Failed to create profile';
}
