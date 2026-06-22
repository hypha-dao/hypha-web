import { headers } from 'next/headers';
import {
  createIdGenerator,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from 'ai';
import {
  chatRequestSchema,
  type ChatRequestPayload,
  createChatStreamResult,
  MISSING_OPENROUTER_KEY_MESSAGE,
  OPENROUTER_DEBUG,
  verifyPrivyAuthToken,
} from '@hypha-platform/chat-server';
import {
  getEnableEcosystemAutomation,
  getEnableOnboardingWriteTools,
} from '@hypha-platform/feature-flags';
import { authorizeSpacePanelInteraction } from '@hypha-platform/core/server';

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
  const conversationContext = parsed.data.conversationContext;
  const isOnboardingSetup = conversationContext?.mode === 'onboarding_setup';

  if (spaceSlug?.trim() && !isOnboardingSetup) {
    const interactionAuth = await authorizeSpacePanelInteraction({
      spaceSlug: spaceSlug.trim(),
      authToken,
    });
    if (!interactionAuth.authorized) {
      return createChatFailureStreamResponse({
        debugRequestId,
        errorType: 'forbidden',
        message: interactionAuth.message,
      });
    }
  }

  const [onboardingWriteToolsEnabled, ecosystemAutomationEnabled] =
    await Promise.all([
      getEnableOnboardingWriteTools(),
      getEnableEcosystemAutomation(),
    ]);

  let result: Awaited<ReturnType<typeof createChatStreamResult>>;
  try {
    result = await createChatStreamResult(messages, spaceSlug, authToken, {
      debugRequestId,
      requestUrlForSessionMatrix: req.url,
      conversationContext,
      onboardingWriteToolsEnabled,
      ecosystemAutomationEnabled,
    });
  } catch (error) {
    console.error('[chat][route][stream-init-error]', {
      debugRequestId,
      message: error instanceof Error ? error.message : String(error),
      ...(OPENROUTER_DEBUG && { error }),
    });

    const message =
      error instanceof Error && error.message === MISSING_OPENROUTER_KEY_MESSAGE
        ? 'Hypha AI is not available on this deployment because the assistant API is not configured (missing OpenRouter credentials). Contact your team or administrator.'
        : 'I hit an issue while starting the response. Please retry in a few seconds.';

    return createChatFailureStreamResponse({
      debugRequestId,
      errorType: 'stream_init_error',
      message,
    });
  }

  // Native UI stream: forwards tool rounds, text/reasoning deltas, and errors per AI SDK v6.
  // Pass through the client message list + stable IDs so the stream `start` chunk includes
  // `messageId` (useChat / DefaultChatTransport expect this for assistant message correlation).
  return result.toUIMessageStreamResponse({
    headers: {
      'x-hypha-chat-debug-id': debugRequestId,
    },
    originalMessages: messages as UIMessage[],
    generateMessageId: createIdGenerator({ prefix: 'msg', size: 12 }),
  });
}
