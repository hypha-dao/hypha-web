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
        let accumulatedText = '';
        const toolOutputs: Array<{ toolName: string; output: unknown }> = [];
        writer.write({ type: 'start' });
        writer.write({ type: 'text-start', id: textPartId });

        const fullStream = (result as { fullStream?: AsyncIterable<unknown> })
          .fullStream;

        const writeDelta = (delta: string) => {
          if (!delta) return;
          accumulatedText += delta;
          writer.write({ type: 'text-delta', id: textPartId, delta });
        };

        /** AI SDK v6+ uses `text` on text-delta; some paths use `delta` or `textDelta` (see ai/dist StreamText fullStream). */
        const writeTextFromChunk = (chunk: Record<string, unknown>) => {
          const fromText = chunk.text;
          const fromDelta = chunk.delta;
          const fromTextDelta = chunk.textDelta;
          const s =
            typeof fromText === 'string'
              ? fromText
              : typeof fromDelta === 'string'
              ? fromDelta
              : typeof fromTextDelta === 'string'
              ? fromTextDelta
              : '';
          if (s) writeDelta(s);
        };

        try {
          if (fullStream) {
            for await (const chunk of fullStream) {
              if (!chunk || typeof chunk !== 'object') continue;
              const typed = chunk as Record<string, unknown>;
              const chunkType = typed.type;

              if (
                chunkType === 'text-delta' ||
                chunkType === 'reasoning-delta'
              ) {
                writeTextFromChunk(typed);
                continue;
              }
              if (chunkType === 'text' && typeof typed.text === 'string') {
                writeDelta(typed.text);
                continue;
              }
              // Legacy/alternate shapes
              writeTextFromChunk(typed);
              if ('value' in typed) {
                const v = typed.value;
                if (typeof v === 'string') writeDelta(v);
              }
              if ('content' in typed) {
                const c = typed.content;
                if (typeof c === 'string') writeDelta(c);
              }
              if (chunkType === 'tool-result') {
                toolOutputs.push({
                  toolName:
                    typeof typed.toolName === 'string'
                      ? typed.toolName
                      : 'tool',
                  output: typed.output,
                });
              }
              if (chunkType === 'error' && 'error' in typed) {
                const err = typed.error;
                const msg =
                  err instanceof Error
                    ? err.message
                    : typeof err === 'string'
                    ? err
                    : JSON.stringify(err);
                console.error('[chat][ui-stream][chunk-error]', {
                  debugRequestId,
                  message: msg,
                });
              }
            }
          } else {
            for await (const delta of result.textStream) {
              if (!delta) continue;
              writeDelta(delta);
            }
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
          accumulatedText +=
            'I ran into an issue while generating the response. Please retry in a few seconds.';
        }

        if (!accumulatedText.trim()) {
          // Secondary fallback: some SDK/provider paths accumulate only in `result.text`.
          try {
            const textResult = (
              result as unknown as {
                text?: string | PromiseLike<string | undefined>;
              }
            ).text;
            const resolvedText =
              typeof textResult === 'string'
                ? textResult
                : await Promise.resolve(textResult).catch(() => undefined);
            if (typeof resolvedText === 'string' && resolvedText.trim()) {
              writeDelta(resolvedText);
            }
          } catch {
            // Ignore and continue to tool/empty fallbacks below.
          }
        }

        if (!accumulatedText.trim()) {
          if (toolOutputs.length > 0) {
            const latest = toolOutputs.at(-1);
            if (latest) {
              let renderedOutput = '';
              try {
                renderedOutput =
                  typeof latest.output === 'string'
                    ? latest.output
                    : JSON.stringify(latest.output);
              } catch {
                renderedOutput = String(latest.output);
              }
              const toolSummary = renderedOutput.trim()
                ? `I gathered context via \`${latest.toolName}\`, but no narrative text was produced. Here is the latest result:\n\n${renderedOutput}`
                : `I gathered context via \`${latest.toolName}\`, but no narrative text was produced. Please retry and I will continue from that result.`;
              writer.write({
                type: 'text-delta',
                id: textPartId,
                delta: toolSummary,
              });
              accumulatedText += toolSummary;
            }
          }
        }

        if (!accumulatedText.trim()) {
          console.warn('[chat][ui-stream][empty-text-fallback]', {
            debugRequestId,
          });
          writer.write({
            type: 'text-delta',
            id: textPartId,
            delta:
              'I could not produce a visible answer for that request. Please try again or rephrase the question.',
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

  return createChatTextOnlyStreamResponse({ result, debugRequestId });
}
