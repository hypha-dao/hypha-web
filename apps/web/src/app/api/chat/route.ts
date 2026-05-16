import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  chatRequestSchema,
  type ChatRequestPayload,
  createChatStreamResult,
  isAbortLikeError,
  OPENROUTER_DEBUG,
  verifyPrivyAuthToken,
} from '@hypha-platform/chat-server';

export const maxDuration = 300;

export async function POST(req: Request) {
  const debugRequestId = `chat-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const headersList = await headers();
  const authToken = headersList.get('Authorization')?.split(' ')[1] || '';
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authResult = await verifyPrivyAuthToken(authToken);
  if (!authResult.valid) {
    return NextResponse.json(
      { error: 'Unauthorized', reason: authResult.reason },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request payload', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const messages: ChatRequestPayload['messages'] = parsed.data.messages;
  const spaceSlug = parsed.data.spaceSlug;

  let result: Awaited<ReturnType<typeof createChatStreamResult>>;
  try {
    result = await createChatStreamResult(messages, spaceSlug, authToken, {
      debugRequestId,
      requestUrlForSessionMatrix: req.url,
    });
  } catch (error) {
    console.error('[chat][route][stream-init-error]', {
      debugRequestId,
      message: error instanceof Error ? error.message : String(error),
      ...(OPENROUTER_DEBUG && { error }),
    });

    return NextResponse.json(
      { error: 'STREAM_ERROR' },
      {
        status: 502,
        headers: {
          'x-hypha-chat-debug-id': debugRequestId,
        },
      },
    );
  }

  return result.toUIMessageStreamResponse({
    headers: {
      'x-hypha-chat-debug-id': debugRequestId,
    },
    onError: (error) => {
      if (isAbortLikeError(error)) {
        if (OPENROUTER_DEBUG) {
          console.warn('[chat][ui-stream][abort]', { debugRequestId });
        }
        return '';
      }
      console.error('[chat][ui-stream][error]', {
        debugRequestId,
        message: error instanceof Error ? error.message : String(error),
        ...(OPENROUTER_DEBUG && { error }),
      });
      // Non-locale API route — return a generic error code the client can map to a translation.
      // The client-side AiPanel component handles localized display via the 'streamError' i18n key.
      return 'STREAM_ERROR';
    },
  });
}
