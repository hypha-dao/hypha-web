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
};

export async function createChatStreamResult(
  messages: ChatRequestPayload['messages'],
  spaceSlug: string | null | undefined,
  authToken: string,
  { debugRequestId }: ChatStreamCallbacks,
): Promise<ReturnType<typeof streamText>> {
  const tools = createChatTools(authToken);

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
    messages: await convertToModelMessages(messages as UIMessage[]),

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
