import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  RealtimeVoiceSessionError,
  synthesizeSpeechScript,
  verifyPrivyAuthToken,
} from '@hypha-platform/chat-server';
import { getEnableOnboardingVoiceRealtime } from '@hypha-platform/feature-flags';

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!getEnableOnboardingVoiceRealtime()) {
    return NextResponse.json(
      { error: 'not_enabled', message: 'Voice is disabled.' },
      { status: 404 },
    );
  }

  const headersList = await headers();
  const authToken = headersList.get('Authorization')?.split(' ')[1] || '';
  if (!authToken) {
    return NextResponse.json(
      { error: 'auth_missing', message: 'Authentication is required.' },
      { status: 401 },
    );
  }

  const authResult = await verifyPrivyAuthToken(authToken);
  if (!authResult.valid) {
    return NextResponse.json(
      { error: 'auth_failed', message: 'Authentication failed.' },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', message: 'Invalid speech request.' },
      { status: 400 },
    );
  }

  const text =
    body &&
    typeof body === 'object' &&
    'text' in body &&
    typeof (body as { text?: unknown }).text === 'string'
      ? (body as { text: string }).text.trim()
      : '';
  if (!text || text.length > 4000) {
    return NextResponse.json(
      { error: 'validation_failed', message: 'The speech script is invalid.' },
      { status: 400 },
    );
  }

  try {
    const audio = await synthesizeSpeechScript(text);
    return new NextResponse(new Uint8Array(audio), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof RealtimeVoiceSessionError) {
      const status = error.code === 'missing_api_key' ? 503 : 502;
      console.error('[voice][speak]', error.code, error.message);
      return NextResponse.json(
        { error: error.code, message: 'Could not speak that line.' },
        { status },
      );
    }
    console.error(
      '[voice][speak]',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: 'internal_error', message: 'Could not speak that line.' },
      { status: 500 },
    );
  }
}
