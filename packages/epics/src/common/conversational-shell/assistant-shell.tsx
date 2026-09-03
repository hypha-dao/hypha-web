'use client';

import * as React from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

import { cn } from '@hypha-platform/ui-utils';

import { InteractionBar } from './interaction-bar';
import { CanvasSurface } from './canvas-surface';
import { NextActionsStrip } from './next-actions-strip';
import { createWidgetRegistry } from './widget-registry';
import { useCanvas } from './use-canvas';
import { useRecap } from './use-recap';
import type {
  AssistantSessionConfig,
  ConversationMessage,
  GreetingContext,
  NextAction,
  WidgetEvent,
} from './types';

/** Everything the shell needs from the host to reach the chat backend. */
export interface AssistantTransportConfig {
  /** Chat streaming endpoint. Defaults to `/api/chat`. */
  endpoint?: string;
  /** Bearer token provider for the request. */
  getAuthToken?: () => Promise<string | undefined | null>;
  /** Extra per-request body merged after the shell's own canvas context. */
  buildRequestBody?: () =>
    | Record<string, unknown>
    | Promise<Record<string, unknown>>;
}

export interface AssistantShellProps {
  config: AssistantSessionConfig;
  greetingContext: GreetingContext;
  transport: AssistantTransportConfig;
  /** Stable id for `useChat` + persistence. Defaults to `assistant-global`. */
  sessionId?: string;
  /** Leading slot in the interaction bar (mode toggle). */
  modeToggleSlot?: React.ReactNode;
  /** Trailing slot in the interaction bar (profile avatar). */
  trailingSlot?: React.ReactNode;
  /** Voice control node (milestone 7); absent → decorative mic. */
  voiceControl?: React.ReactNode;
  /** Waveform node (milestone 7); absent → decorative pulse. */
  waveform?: React.ReactNode;
  className?: string;
}

const PERSIST_PREFIX = 'hypha:assistant:v1:';

function loadPersisted(sessionId: string): ConversationMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`${PERSIST_PREFIX}${sessionId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ConversationMessage[]) : [];
  } catch {
    return [];
  }
}

function persist(sessionId: string, messages: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `${PERSIST_PREFIX}${sessionId}`,
      JSON.stringify(messages),
    );
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Generic talk-first shell (#2486 §5.1). Composes the interaction bar, the
 * conversation transport (`useChat`), the canvas reducer and the recency stack.
 * Everything Hypha-specific arrives through `config` + the slots.
 */
export function AssistantShell({
  config,
  greetingContext,
  transport,
  sessionId = 'assistant-global',
  modeToggleSlot,
  trailingSlot,
  voiceControl,
  waveform,
  className,
}: AssistantShellProps) {
  const registry = React.useMemo(() => {
    const created = createWidgetRegistry();
    config.registryManifest(created);
    return created;
  }, [config]);

  const greeting = React.useMemo(
    () => config.greeting(greetingContext),
    [config, greetingContext],
  );

  const spaceSlug = React.useMemo(
    () => config.scopeResolver.resolveSpaceSlug(greetingContext),
    [config, greetingContext],
  );

  const widgetCatalogue = React.useMemo(
    () => registry.catalogueForPrompt(),
    [registry],
  );
  const widgetIds = React.useMemo(
    () => registry.list().map((w) => w.id),
    [registry],
  );

  const endpoint = transport.endpoint ?? '/api/chat';
  const chatTransport = React.useMemo(
    () =>
      new DefaultChatTransport({
        api: endpoint,
        headers: async (): Promise<Record<string, string>> => {
          try {
            const token = await transport.getAuthToken?.();
            return token ? { Authorization: `Bearer ${token}` } : {};
          } catch {
            return {};
          }
        },
        body: {},
      }),
    [endpoint, transport],
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: sessionId,
    transport: chatTransport,
    onError: (chatError) =>
      console.error('[AssistantShell][useChat]', chatError),
  });

  // Hydrate from localStorage once.
  const hydratedRef = React.useRef(false);
  React.useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const stored = loadPersisted(sessionId);
    if (stored.length > 0) {
      setMessages(stored as unknown as Parameters<typeof setMessages>[0]);
    }
  }, [sessionId, setMessages]);

  // Persist on change.
  React.useEffect(() => {
    if (!hydratedRef.current) return;
    persist(sessionId, messages);
  }, [sessionId, messages]);

  const conversationMessages = messages as unknown as ConversationMessage[];
  const { canvasState, nextActions } = useCanvas(
    conversationMessages,
    registry,
  );
  const recap = useRecap(conversationMessages);

  const busy = status === 'streaming' || status === 'submitted';
  const hasConversation = messages.length > 0;

  const buildBody = React.useCallback(async () => {
    const extra = (await transport.buildRequestBody?.()) ?? {};
    return {
      ...(spaceSlug ? { spaceSlug } : {}),
      conversationContext: {
        mode: 'conversational_canvas' as const,
        widgetCatalogue,
        widgetIds,
        ...(spaceSlug ? { spaceSlug } : {}),
      },
      ...extra,
    };
  }, [transport, spaceSlug, widgetCatalogue, widgetIds]);

  const submit = React.useCallback(
    async (text: string) => {
      const body = await buildBody();
      await sendMessage({ text }, { body });
    },
    [buildBody, sendMessage],
  );

  const onSelectAction = React.useCallback(
    (action: NextAction) => {
      if (action.prompt) void submit(action.prompt);
      else if (action.href && typeof window !== 'undefined') {
        window.location.assign(action.href);
      }
    },
    [submit],
  );

  const onWidgetEvent = React.useCallback((event: WidgetEvent) => {
    // v0: widgets behave as the real epic components; no conversation side-effect.
    console.debug('[AssistantShell] widget event', event);
  }, []);

  const [historyExpanded, setHistoryExpanded] = React.useState(false);

  const stripActions =
    nextActions.length > 0 ? nextActions : greeting.nextActions;

  return (
    <div className={cn('flex w-full flex-col', className)}>
      <div className="sticky top-0 z-20">
        <InteractionBar
          onSubmit={(text) => void submit(text)}
          busy={busy}
          disabled={false}
          modeToggleSlot={modeToggleSlot}
          trailingSlot={trailingSlot}
          voiceControl={voiceControl}
          waveform={waveform}
          historyExpanded={historyExpanded}
          onToggleHistory={() => setHistoryExpanded((v) => !v)}
          recencySlot={
            hasConversation ? (
              <RecencyStack recap={recap} />
            ) : (
              <span className="text-muted-foreground">{greeting.text}</span>
            )
          }
          transcriptSlot={<Transcript messages={conversationMessages} />}
        />
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
        <NextActionsStrip actions={stripActions} onSelect={onSelectAction} />

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error.message || 'Something went wrong. Try again.'}
          </p>
        )}

        <CanvasSurface
          canvasState={canvasState}
          registry={registry}
          onWidgetEvent={onWidgetEvent}
          emptyState={
            <div className="min-h-[50vh] rounded-lg border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
              {greeting.text}
            </div>
          }
        />
      </div>
    </div>
  );
}

function RecencyStack({ recap }: { recap: ReturnType<typeof useRecap> }) {
  if (recap.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      {recap.map((entry) => (
        <div
          key={entry.messageId}
          className="truncate"
          style={{ opacity: Math.max(0.35, 1 - entry.ageRank * 0.3) }}
        >
          <span className="text-muted-foreground">{entry.askSummary}</span>
          {entry.answerSummary ? (
            <span className="text-foreground/80"> · {entry.answerSummary}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Transcript({ messages }: { messages: ConversationMessage[] }) {
  if (messages.length === 0) {
    return <p className="text-sm text-muted-foreground">No messages yet.</p>;
  }
  return (
    <div className="flex flex-col gap-3 text-sm">
      {messages.map((message, index) => {
        const parts = Array.isArray(message.parts) ? message.parts : [];
        const text = parts
          .map((part) =>
            part &&
            typeof part === 'object' &&
            (part as { type?: unknown }).type === 'text'
              ? String((part as { text?: unknown }).text ?? '')
              : '',
          )
          .join('')
          .trim();
        if (!text) return null;
        return (
          <div key={message.id ?? index}>
            <span className="font-semibold">
              {message.role === 'user' ? 'You' : 'Organization'}:{' '}
            </span>
            <span className="whitespace-pre-wrap">{text}</span>
          </div>
        );
      })}
    </div>
  );
}
