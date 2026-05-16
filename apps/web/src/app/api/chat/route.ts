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
  message,
}: {
  debugRequestId: string;
  message: string;
}) {
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

function createChatTextOnlyStreamResponse({
  result,
  debugRequestId,
}: {
  result: Awaited<ReturnType<typeof createChatStreamResult>>;
  debugRequestId: string;
}) {
  const textPartId = `text-${debugRequestId}`;
  return createUIMessageStreamResponse({
    status: 200,
    headers: {
      'x-hypha-chat-debug-id': debugRequestId,
    },
    stream: createUIMessageStream({
      execute: async ({ writer }) => {
        let sawStreamError = false;
        writer.write({ type: 'start' });
        writer.write({ type: 'text-start', id: textPartId });
        try {
          for await (const delta of result.textStream) {
            if (!delta) continue;
            writer.write({ type: 'text-delta', id: textPartId, delta });
          }
        } catch (error) {
          sawStreamError = true;
          console.error('[chat][ui-stream][text-forward-error]', {
            debugRequestId,
            message: error instanceof Error ? error.message : String(error),
            ...(OPENROUTER_DEBUG && { error }),
          });
          writer.write({
            type: 'text-delta',
            id: textPartId,
            delta:
              'I ran into an issue while generating the response. Please retry in a few seconds.',
          });
        }
        writer.write({ type: 'text-end', id: textPartId });
        writer.write({
          type: 'finish',
          finishReason: sawStreamError ? 'error' : 'stop',
        });
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
      message: 'Authentication is required. Please sign in again and retry.',
    });
  }

  const authResult = await verifyPrivyAuthToken(authToken);
  if (!authResult.valid) {
    return createChatFailureStreamResponse({
      debugRequestId,
      message: `Authentication failed: ${authResult.reason}. Please sign in again and retry.`,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createChatFailureStreamResponse({
      debugRequestId,
      message: 'Invalid chat request payload. Please retry your message.',
    });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return createChatFailureStreamResponse({
      debugRequestId,
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
      message:
        'I hit an issue while starting the response. Please retry in a few seconds.',
    });
  }

  return createChatTextOnlyStreamResponse({ result, debugRequestId });
}
