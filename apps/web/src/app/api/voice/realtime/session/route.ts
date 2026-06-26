import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  createRealtimeVoiceSession,
  RealtimeVoiceSessionContextError,
  RealtimeVoiceSessionError,
  realtimeVoiceSessionRequestSchema,
  verifyPrivyAuthToken,
} from '@hypha-platform/chat-server';
import { getEnableOnboardingVoiceRealtime } from '@hypha-platform/feature-flags';

export const maxDuration = 300;

export async function POST(req: Request) {
  const debugRequestId = `voice-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  if (!getEnableOnboardingVoiceRealtime()) {
    return NextResponse.json(
      {
        error: 'not_enabled',
        message: 'Onboarding voice Realtime is disabled.',
      },
      { status: 404, headers: { 'x-hypha-voice-debug-id': debugRequestId } },
    );
  }

  const headersList = await headers();
  const authToken = headersList.get('Authorization')?.split(' ')[1] || '';
  if (!authToken) {
    return NextResponse.json(
      {
        error: 'auth_missing',
        message: 'Authentication is required. Please sign in again and retry.',
      },
      { status: 401, headers: { 'x-hypha-voice-debug-id': debugRequestId } },
    );
  }

  const authResult = await verifyPrivyAuthToken(authToken);
  if (!authResult.valid) {
    return NextResponse.json(
      {
        error: 'auth_failed',
        message: `Authentication failed: ${authResult.reason}. Please sign in again and retry.`,
      },
      { status: 401, headers: { 'x-hypha-voice-debug-id': debugRequestId } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: 'invalid_json',
        message: 'Invalid voice session request payload.',
      },
      { status: 400, headers: { 'x-hypha-voice-debug-id': debugRequestId } },
    );
  }

  const parsed = realtimeVoiceSessionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'validation_failed',
        message: 'The voice session request format is invalid.',
      },
      { status: 400, headers: { 'x-hypha-voice-debug-id': debugRequestId } },
    );
  }

  try {
    const session = await createRealtimeVoiceSession(parsed.data);
    return NextResponse.json(
      {
        clientSecret: session.clientSecret,
        sessionId: session.sessionId,
        expiresAt: session.expiresAt,
        model: session.model,
        voice: session.voice,
        transcriptionModel: session.transcriptionModel,
        turnDetection: session.turnDetection,
      },
      { headers: { 'x-hypha-voice-debug-id': debugRequestId } },
    );
  } catch (error) {
    if (error instanceof RealtimeVoiceSessionContextError) {
      return NextResponse.json(
        { error: 'forbidden', message: error.message },
        { status: 403, headers: { 'x-hypha-voice-debug-id': debugRequestId } },
      );
    }

    if (error instanceof RealtimeVoiceSessionError) {
      const status =
        error.code === 'missing_api_key'
          ? 503
          : error.code === 'upstream_error'
          ? 502
          : 500;
      const message =
        error.code === 'missing_api_key'
          ? 'Hypha voice Realtime is not available on this deployment because OpenAI credentials are missing.'
          : error.message;

      console.error('[voice][realtime][session-error]', {
        debugRequestId,
        code: error.code,
        message: error.message,
      });

      return NextResponse.json(
        { error: error.code, message },
        { status, headers: { 'x-hypha-voice-debug-id': debugRequestId } },
      );
    }

    console.error('[voice][realtime][session-error]', {
      debugRequestId,
      message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'Could not start a voice Realtime session. Please retry.',
      },
      { status: 500, headers: { 'x-hypha-voice-debug-id': debugRequestId } },
    );
  }
}
