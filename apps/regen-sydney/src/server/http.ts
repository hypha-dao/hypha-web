import 'server-only';

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { AuthError } from './auth';
import { VotingError } from './campaign/voting';
import { PaymentProviderError } from './payments';

/**
 * One place that turns a thrown domain error into a response, so routes can
 * stay linear and never leak an internal message to the browser by accident.
 */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'That request was not valid', details: error.format() },
      { status: 400 },
    );
  }
  if (
    error instanceof AuthError ||
    error instanceof VotingError ||
    error instanceof PaymentProviderError
  ) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  console.error('Unhandled campaign API error:', error);
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}

export async function handle(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}
