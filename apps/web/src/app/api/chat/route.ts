import { headers } from 'next/headers';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import {
  chatRequestSchema,
  type ChatRequestPayload,
  createChatStreamResult,
  OPENROUTER_DEBUG,
  verifyPrivyAuthToken,
} from '@hypha-platform/chat-server';

export const maxDuration = 300;

function createChatFailureStreamResponse({
  debugRequestId,
  errorType,
  message,
}: {
  debugRequestId: string;
  errorType: string;
  message: string;
}) {
  console.error('[chat][failure-stream]', {
    debugRequestId,
    errorType,
    message,
  });
  const textPartId = `text-${debugRequestId}`;
  return createUIMessageStreamResponse({
    status: 200,
    headers: {
      'x-hypha-chat-debug-id': debugRequestId,
    },
    stream: createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: 'start' });
        writer.write({ type: 'text-start', id: textPartId });
        writer.write({ type: 'text-delta', id: textPartId, delta: message });
        writer.write({ type: 'text-end', id: textPartId });
        writer.write({ type: 'finish', finishReason: 'error' });
      },
    }),
  });
}

export async function POST(req: Request) {
  const debugRequestId = `chat-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const headersList = await headers();
  const authToken = headersList.get('Authorization')?.split(' ')[1] || '';
  if (!authToken) {
    return createChatFailureStreamResponse({
      debugRequestId,
      errorType: 'auth_missing',
      message: 'Authentication is required. Please sign in again and retry.',
    });
  }

  const authResult = await verifyPrivyAuthToken(authToken);
  if (!authResult.valid) {
    return createChatFailureStreamResponse({
      debugRequestId,
      errorType: 'auth_failed',
      message: `Authentication failed: ${authResult.reason}. Please sign in again and retry.`,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createChatFailureStreamResponse({
      debugRequestId,
      errorType: 'invalid_json',
      message: 'Invalid chat request payload. Please retry your message.',
    });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return createChatFailureStreamResponse({
      debugRequestId,
      errorType: 'validation_failed',
      message:
        'The chat request format is invalid for this session. Please retry.',
    });
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

    return createChatFailureStreamResponse({
      debugRequestId,
      errorType: 'stream_init_error',
      message:
        'I hit an issue while starting the response. Please retry in a few seconds.',
    });
  }

  // Native UI stream: forwards tool rounds, text/reasoning deltas, and errors per AI SDK v6.
  // Manual fullStream bridging missed some chunk shapes and produced empty assistant text.
  return result.toUIMessageStreamResponse({
    headers: {
      'x-hypha-chat-debug-id': debugRequestId,
    },
  });
}
