import { convertToModelMessages, stepCountIs, streamText } from 'ai';
import { openrouter } from '@openrouter/ai-sdk-provider';
import type { UIMessage } from 'ai';
import type { ChatRequestPayload } from './request-schema';
import { buildSystemPrompt } from './system-prompt';
import { createChatTools } from './tools/index';

export const OPENROUTER_DEBUG = process.env.OPENROUTER_DEBUG === 'true';

/** Narrowed shape when `isAbortLikeError` returns true (abort-like DOM/undici errors). */
export type AbortLikeCandidate = { name?: string; message?: string };

export function isAbortLikeError(error: unknown): error is AbortLikeCandidate {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as AbortLikeCandidate;
  return (
    maybeError.name === 'AbortError' ||
    maybeError.message?.toLowerCase().includes('aborted') === true
  );
}

export type ChatStreamCallbacks = {
  debugRequestId: string;
  /** Lets org memory resolve the viewer's Matrix token (same as Space Memory API). */
  requestUrlForSessionMatrix?: string;
};

function sanitizeMessagesToTextOnly(
  messages: ChatRequestPayload['messages'],
): UIMessage[] {
  return messages.map((message) => {
    const safeRole: UIMessage['role'] =
      message.role === 'system' ||
      message.role === 'user' ||
      message.role === 'assistant'
        ? message.role
        : 'user';

    const explicitTextParts = (message.parts ?? [])
      .filter(
        (part): part is { type: 'text'; text: string } =>
          part != null &&
          typeof part === 'object' &&
          part.type === 'text' &&
          typeof (part as { text?: unknown }).text === 'string',
      )
      .map((part) => ({ type: 'text' as const, text: part.text }));

    const fallbackTextParts =
      explicitTextParts.length > 0
        ? explicitTextParts
        : typeof message.content === 'string' &&
          message.content.trim().length > 0
        ? [{ type: 'text' as const, text: message.content }]
        : [];

    return {
      id: message.id,
      role: safeRole,
      parts: fallbackTextParts,
    };
  });
}

async function convertMessagesSafely(
  messages: ChatRequestPayload['messages'],
  debugRequestId: string,
): Promise<Awaited<ReturnType<typeof convertToModelMessages>>> {
  try {
    // Cast: request schema validates the runtime shape of UI messages from `useChat`.
    return await convertToModelMessages(messages as UIMessage[]);
  } catch (error) {
    console.error('[chat][convert-messages][fallback-to-text-only]', {
      debugRequestId,
      message: error instanceof Error ? error.message : String(error),
      ...(OPENROUTER_DEBUG && { error }),
    });
    return convertToModelMessages(sanitizeMessagesToTextOnly(messages));
  }
}

export async function createChatStreamResult(
  messages: ChatRequestPayload['messages'],
  spaceSlug: string | null | undefined,
  authToken: string,
  { debugRequestId, requestUrlForSessionMatrix }: ChatStreamCallbacks,
): Promise<ReturnType<typeof streamText>> {
  const tools = createChatTools(authToken, requestUrlForSessionMatrix);
  const modelMessages = await convertMessagesSafely(messages, debugRequestId);

  if (OPENROUTER_DEBUG) {
    console.log('[chat][openrouter][start]', {
      debugRequestId,
      model: 'openrouter/auto',
      messageCount: messages.length,
      spaceSlug: spaceSlug ?? null,
    });
  }

  return streamText({
    model: openrouter('openrouter/auto'),
    system: buildSystemPrompt(spaceSlug),
    messages: modelMessages,

    // Cast: ChatRouteTool's generic Zod input doesn't satisfy ai's CoreTool typing, but is structurally compatible at runtime.
    tools: tools as unknown as Parameters<typeof streamText>[0]['tools'],
    stopWhen: stepCountIs(6),
    onStepFinish: (event) => {
      if (!OPENROUTER_DEBUG) return;

      console.log('[chat][openrouter][step-finish]', {
        debugRequestId,
        stepNumber: event.stepNumber,
        provider: event.model.provider,
        modelId: event.model.modelId,
        finishReason: event.finishReason,
        responseId: event.response?.id,
        usage: event.usage,
        openrouterProviderMetadata:
          event.providerMetadata &&
          typeof event.providerMetadata === 'object' &&
          'openrouter' in event.providerMetadata
            ? (event.providerMetadata as { openrouter?: unknown }).openrouter
            : undefined,
      });
    },
    onFinish: (event) => {
      if (!OPENROUTER_DEBUG) return;

      const generationId = event.response?.id;
      const generationUrl = generationId
        ? `https://openrouter.ai/api/v1/generation?id=${generationId}`
        : null;

      console.log('[chat][openrouter][finish]', {
        debugRequestId,
        provider: event.model.provider,
        modelId: event.model.modelId,
        responseId: generationId,
        generationUrl,
        finishReason: event.finishReason,
        totalUsage: event.totalUsage,
        warnings: event.warnings,
      });
    },
    onError: ({ error }) => {
      if (isAbortLikeError(error)) {
        if (OPENROUTER_DEBUG) {
          console.warn('[chat][openrouter][abort]', { debugRequestId });
        }
        return;
      }
      console.error('[chat][openrouter][error]', {
        debugRequestId,
        message: error instanceof Error ? error.message : String(error),
        ...(OPENROUTER_DEBUG && { error }),
      });
    },
  });
}
