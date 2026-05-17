import {
  APICallError,
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
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { ChatRequestPayload } from './request-schema';
import { buildSystemPrompt, sanitizeSlug } from './system-prompt';
import { createChatTools, getSpaceBySlugTool } from './tools/index';

export const OPENROUTER_DEBUG = process.env.OPENROUTER_DEBUG === 'true';

/** Thrown before `streamText` when deployment is missing OpenRouter credentials (matches provider default env). */
export const MISSING_OPENROUTER_KEY_MESSAGE =
  'Hypha AI is not configured: OPENROUTER_API_KEY is missing.';

const DEFAULT_OPENROUTER_CHAT_MODEL = 'openai/gpt-4o-mini';

/** @see https://openrouter.ai/docs/api/reference/authorization — Referer + title are required for many keys. */
function buildOpenRouterAppHeaders(): Record<string, string> {
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL?.trim()
      ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`
      : '') ||
    'https://hypha.earth';

  const title = process.env.OPENROUTER_APP_TITLE?.trim() || 'Hypha Platform';

  return {
    'HTTP-Referer': referer,
    'X-Title': title,
  };
}

/**
 * Provider with strict OpenRouter compatibility plus required attribution headers.
 * The package default export omits Referer/title and can trigger 401 "User not found".
 */
const openrouterWithHyphaHeaders = createOpenRouter({
  compatibility: 'strict',
  headers: buildOpenRouterAppHeaders(),
});

/**
 * OpenRouter model id for Hypha chat.
 *
 * Avoid `openrouter/auto` (and env overrides that point at it): multiple stacks see
 * spurious 401 "User not found" from the auto-router even when the same API key works
 * for concrete models. Use `OPENROUTER_CHAT_MODEL` for a stable id.
 */
function resolveOpenRouterChatModelId(): string {
  const fromEnv = process.env.OPENROUTER_CHAT_MODEL?.trim();
  if (!fromEnv) return DEFAULT_OPENROUTER_CHAT_MODEL;

  const normalizedForCompare = fromEnv.toLowerCase();
  if (
    normalizedForCompare === 'openrouter/auto' ||
    normalizedForCompare.endsWith('/openrouter/auto')
  ) {
    console.warn(
      '[chat][openrouter][model-env-ignored] OPENROUTER_CHAT_MODEL is set to the auto router; using a concrete model instead.',
      { requested: fromEnv, using: DEFAULT_OPENROUTER_CHAT_MODEL },
    );
    return DEFAULT_OPENROUTER_CHAT_MODEL;
  }

  return fromEnv;
}

function messageFromUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

const OPENROUTER_AUTH_FAILURE_REPLY =
  'OpenRouter could not run this chat (often 401). Check OPENROUTER_API_KEY on the server. Hypha sends HTTP-Referer and X-Title automatically; override with OPENROUTER_HTTP_REFERER / OPENROUTER_APP_TITLE if needed.';

function isSpaceOverviewQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return (
    t.includes('tell me about this space') ||
    t.includes('about this space') ||
    t.includes('describe this space') ||
    t.includes('space overview') ||
    t.includes('how many members') ||
    t.includes('member count')
  );
}

async function buildDeterministicSpaceFallback({
  lastUserText,
  spaceSlug,
  debugRequestId,
}: {
  lastUserText: string | null;
  spaceSlug: string | null | undefined;
  debugRequestId: string;
}): Promise<string | null> {
  if (!lastUserText || !isSpaceOverviewQuestion(lastUserText)) return null;

  const safe = spaceSlug ? sanitizeSlug(spaceSlug) : null;
  if (!safe) return null;

  try {
    const result = await getSpaceBySlugTool.execute({ slug: safe });
    if (!result || typeof result !== 'object') return null;

    const found =
      'found' in result && typeof result.found === 'boolean'
        ? result.found
        : false;
    if (!found) return null;

    const space =
      'space' in result &&
      result.space &&
      typeof result.space === 'object' &&
      !Array.isArray(result.space)
        ? result.space
        : null;
    if (!space) return null;

    const title =
      'title' in space && typeof space.title === 'string' ? space.title : safe;
    const description =
      'description' in space && typeof space.description === 'string'
        ? space.description.trim()
        : '';
    const memberCount =
      'memberCount' in space && typeof space.memberCount === 'number'
        ? space.memberCount
        : null;
    const documentCount =
      'documentCount' in space && typeof space.documentCount === 'number'
        ? space.documentCount
        : null;
    const subspaceCount =
      'subspaceCount' in space && typeof space.subspaceCount === 'number'
        ? space.subspaceCount
        : null;

    const lines = [`${title}`];
    if (description) lines.push(description);
    const statBits = [
      memberCount != null ? `${memberCount} members` : null,
      documentCount != null ? `${documentCount} documents` : null,
      subspaceCount != null ? `${subspaceCount} subspaces` : null,
    ].filter(Boolean);
    if (statBits.length > 0) lines.push(`Quick stats: ${statBits.join(', ')}.`);

    lines.push(
      'I used cached Hypha space data because the external model provider is currently unavailable.',
    );
    return lines.join('\n\n');
  } catch (error) {
    console.error('[chat][fallback][space-overview][failed]', {
      debugRequestId,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Maps common OpenRouter auth / auto-router failures to visible assistant text so the
 * UI stream does not emit a fatal `error` chunk (which becomes `useChat` Error: User not found).
 */
function createOpenRouterAuthRecoveryTransform(
  debugRequestId: string,
  deterministicFallbackText: string | null,
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

        const err = chunk.error;
        const message = messageFromUnknownError(err);
        const lower = message.toLowerCase();
        const looksLikeUserNotFound = lower.includes('user not found');
        const openRouter401 =
          APICallError.isInstance(err) && err.statusCode === 401;

        if (looksLikeUserNotFound || openRouter401) {
          console.error('[chat][openrouter][stream-auth-failure]', {
            debugRequestId,
            message,
            ...(APICallError.isInstance(err)
              ? { statusCode: err.statusCode, url: err.url }
              : {}),
          });
          const id = nextTextId();
          controller.enqueue({ type: 'text-start', id });
          controller.enqueue({
            type: 'text-delta',
            id,
            text: deterministicFallbackText ?? OPENROUTER_AUTH_FAILURE_REPLY,
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
  const deterministicFallbackText = await buildDeterministicSpaceFallback({
    lastUserText: extractLastUserText(messages),
    spaceSlug,
    debugRequestId,
  });

  if (modelMessages.length === 0) {
    console.warn('[chat][empty-model-messages]', {
      debugRequestId,
      spaceSlug: spaceSlug ?? null,
      rawMessageCount: messages.length,
    });
  }

  const openRouterModelId = resolveOpenRouterChatModelId();

  if (OPENROUTER_DEBUG) {
    console.log('[chat][openrouter][start]', {
      debugRequestId,
      model: openRouterModelId,
      messageCount: messages.length,
      spaceSlug: spaceSlug ?? null,
    });
  }

  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error(MISSING_OPENROUTER_KEY_MESSAGE);
  }

  return streamText({
    model: openrouterWithHyphaHeaders(openRouterModelId),
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
      const base = {
        debugRequestId,
        message: error instanceof Error ? error.message : String(error),
        ...(APICallError.isInstance(error)
          ? { statusCode: error.statusCode, url: error.url }
          : {}),
        ...(OPENROUTER_DEBUG && { error }),
      };
      console.error('[chat][openrouter][error]', base);
    },

    experimental_transform: createOpenRouterAuthRecoveryTransform(
      debugRequestId,
      deterministicFallbackText,
    ),
  });
}
