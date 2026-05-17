import {
  convertToModelMessages,
  createIdGenerator,
  stepCountIs,
  streamText,
} from 'ai';
import type {
  StreamTextTransform,
  TextStreamPart,
  ToolSet,
  UIMessage,
} from 'ai';
import { openrouter } from '@openrouter/ai-sdk-provider';
import type { ChatRequestPayload } from './request-schema';
import { buildSystemPrompt } from './system-prompt';
import { createChatTools } from './tools/index';

export const OPENROUTER_DEBUG = process.env.OPENROUTER_DEBUG === 'true';

/** Thrown before `streamText` when deployment is missing OpenRouter credentials (matches provider default env). */
export const MISSING_OPENROUTER_KEY_MESSAGE =
  'Hypha AI is not configured: OPENROUTER_API_KEY is missing.';

function messageFromUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

/**
 * OpenRouter and related services sometimes emit an opaque "User not found." stream error.
 * That propagates to the UI as a fatal AI SDK error chunk — replace it with visible assistant text.
 */
function isUserNotFoundStreamMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    normalized === 'user not found' ||
    normalized === 'user not found.' ||
    normalized.includes('user not found')
  );
}

const USER_NOT_FOUND_ASSISTANT_REPLY =
  'Your session is signed in, but Hypha could not match you to a profile in this environment yet. ' +
  'Finish onboarding or profile setup in the app, refresh the page, then try again. ' +
  'If you are on a preview deployment, your account data may differ from production.';

function createStreamErrorRecoveryTransform(
  debugRequestId: string,
): StreamTextTransform<ToolSet> {
  return () => {
    const nextTextId = createIdGenerator({ prefix: 't', size: 12 });
    return new TransformStream<
      TextStreamPart<ToolSet>,
      TextStreamPart<ToolSet>
    >({
      transform(chunk, controller) {
        if (chunk.type !== 'error') {
          controller.enqueue(chunk);
          return;
        }

        const raw = messageFromUnknownError(chunk.error);
        if (isUserNotFoundStreamMessage(raw)) {
          if (OPENROUTER_DEBUG) {
            console.warn('[chat][stream][recovered-user-not-found]', {
              debugRequestId,
              raw,
            });
          }
          const id = nextTextId();
          controller.enqueue({ type: 'text-start', id });
          controller.enqueue({
            type: 'text-delta',
            id,
            text: USER_NOT_FOUND_ASSISTANT_REPLY,
          });
          controller.enqueue({ type: 'text-end', id });
          return;
        }

        controller.enqueue(chunk);
      },
    });
  };
}

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
  return messages
    .map((message) => {
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

      const hasFileParts = (message.parts ?? []).some(
        (part) =>
          part != null &&
          typeof part === 'object' &&
          (part as { type?: string }).type === 'file',
      );

      /** File-only turns were dropped entirely → empty prompt and no assistant text. */
      const fileOnlySynthetic =
        explicitTextParts.length === 0 && hasFileParts
          ? [
              {
                type: 'text' as const,
                text: '[User attached file(s) with no text. Use tools (org memory, documents, etc.) as needed; if context is insufficient, ask a short clarifying question.]',
              },
            ]
          : [];

      const fallbackTextParts =
        explicitTextParts.length > 0
          ? explicitTextParts
          : fileOnlySynthetic.length > 0
          ? fileOnlySynthetic
          : typeof message.content === 'string' &&
            message.content.trim().length > 0
          ? [{ type: 'text' as const, text: message.content }]
          : [];

      return {
        id: message.id,
        role: safeRole,
        parts: fallbackTextParts,
      };
    })
    .filter((message) => message.parts.length > 0);
}

function extractLastUserText(
  messages: ChatRequestPayload['messages'],
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message) continue;
    const parts = message.parts ?? [];
    for (const part of parts) {
      if (
        part &&
        typeof part === 'object' &&
        part.type === 'text' &&
        'text' in part &&
        typeof part.text === 'string'
      ) {
        const text = part.text.trim();
        if (text) return text;
      }
    }
    if (typeof message.content === 'string' && message.content.trim()) {
      return message.content.trim();
    }
  }
  return null;
}

async function convertMessagesSafely(
  messages: ChatRequestPayload['messages'],
  debugRequestId: string,
): Promise<Awaited<ReturnType<typeof convertToModelMessages>>> {
  try {
    // Always normalize to explicit text parts first. Some clients send `content`
    // with empty `parts`; relying on raw conversion can silently yield empty prompts.
    const sanitized = sanitizeMessagesToTextOnly(messages);
    if (sanitized.length > 0) {
      return await convertToModelMessages(sanitized);
    }

    const lastUserText = extractLastUserText(messages);
    if (lastUserText) {
      return convertToModelMessages([
        {
          role: 'user',
          parts: [{ type: 'text', text: lastUserText }],
        },
      ]);
    }
    return [];
  } catch (error) {
    console.error('[chat][convert-messages][failed]', {
      debugRequestId,
      message: error instanceof Error ? error.message : String(error),
      ...(OPENROUTER_DEBUG && { error }),
    });
    return [];
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

  if (modelMessages.length === 0) {
    console.warn('[chat][empty-model-messages]', {
      debugRequestId,
      spaceSlug: spaceSlug ?? null,
      rawMessageCount: messages.length,
    });
  }

  if (OPENROUTER_DEBUG) {
    console.log('[chat][openrouter][start]', {
      debugRequestId,
      model: 'openrouter/auto',
      messageCount: messages.length,
      spaceSlug: spaceSlug ?? null,
    });
  }

  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error(MISSING_OPENROUTER_KEY_MESSAGE);
  }

  return streamText({
    model: openrouter('openrouter/auto'),
    system: buildSystemPrompt(spaceSlug),
    messages:
      modelMessages.length > 0
        ? modelMessages
        : [
            {
              role: 'user',
              content:
                'The latest user message had no readable text (for example, only unsupported attachment parts). Briefly ask the user to type their question in words, or confirm what they need.',
            },
          ],

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

    // Turn selected provider error chunks into assistant text so the UI stream does not fail closed.
    experimental_transform: createStreamErrorRecoveryTransform(debugRequestId),
  });
}
