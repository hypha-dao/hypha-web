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
import { useScope, clearPersistedScope } from './use-scope';
import { ScopeSelector } from './scope-selector';
import type {
  AssistantSessionConfig,
  ConversationMessage,
  GreetingContext,
  NextAction,
  ScopeCandidate,
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
  /**
   * Spaces the member can scope the conversation to (M7). Feeds the scope
   * selector and the model's `set_scope` name↔slug resolution.
   */
  scopeCandidates?: ScopeCandidate[];
  /** Notified whenever the resolved active space changes (drives host guidance). */
  onActiveScopeChange?: (spaceSlug: string | undefined) => void;
  /** Leading slot in the interaction bar (mode toggle). */
  modeToggleSlot?: React.ReactNode;
  /** Trailing slot in the interaction bar (profile avatar). */
  trailingSlot?: React.ReactNode;
  /**
   * D5 guidance beat — one host-computed health nudge, always pinned to the
   * strip (alongside the fallback or model-set actions). A model-set
   * `emphasis: 'guidance'` chip takes precedence over this one.
   */
  guidanceAction?: NextAction | null;
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

function clearPersisted(sessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`${PERSIST_PREFIX}${sessionId}`);
  } catch {
    // ignore
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
  scopeCandidates,
  onActiveScopeChange,
  modeToggleSlot,
  trailingSlot,
  guidanceAction,
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

  const seedSlug = React.useMemo(
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
    // Coalesce streamed message updates: without this, every token
    // synchronously re-renders the shell and re-runs the canvas / recap /
    // scope reducers (each a full-message-array scan). A tool-heavy turn
    // bursts those fast enough to trip React's nested-update guard
    // ("Maximum update depth exceeded"). ~30 fps is imperceptible here since
    // the canvas, not the token stream, carries the detail.
    experimental_throttle: 33,
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

  // M7 — stateful conversational scope (manual selector + model `set_scope`),
  // seeded once by `scopeResolver`.
  const scope = useScope(conversationMessages, { seedSlug, sessionId });
  const spaceSlug = scope.activeSpaceSlug;

  const busy = status === 'streaming' || status === 'submitted';

  // TEMP DIAG (#2486 M7 — remove once canvas-update + render-loop are settled).
  const diagRef = React.useRef<{
    count: number;
    windowStart: number;
    warned: boolean;
    prev: Record<string, unknown>;
    lastToolSig: string;
  }>({
    count: 0,
    windowStart: Date.now(),
    warned: false,
    prev: {},
    lastToolSig: '',
  });
  {
    const d = diagRef.current;
    const now = Date.now();
    if (now - d.windowStart > 1000) {
      d.count = 0;
      d.windowStart = now;
      d.warned = false;
    }
    d.count += 1;

    // What tool parts are actually in the message array right now?
    const toolCounts: Record<string, number> = {};
    for (const m of messages as unknown as ConversationMessage[]) {
      const parts = Array.isArray(m.parts) ? m.parts : [];
      for (const p of parts) {
        const t = (p as { type?: unknown })?.type;
        if (typeof t === 'string' && t.startsWith('tool-')) {
          const st = String((p as { state?: unknown }).state ?? '?');
          const key = `${t}:${st}`;
          toolCounts[key] = (toolCounts[key] ?? 0) + 1;
        }
      }
    }
    const toolSig = JSON.stringify(toolCounts);
    const stateSig = `${toolSig}|${spaceSlug}|${scope.source}|${
      (scopeCandidates ?? []).length
    }|${canvasState.widgets.map((w) => w.key).join(',')}`;
    if (stateSig !== d.lastToolSig) {
      d.lastToolSig = stateSig;
      console.warn(
        '[AssistantShell][DIAG] tool parts:',
        toolCounts,
        '| canvas widgets:',
        canvasState.widgets.map(
          (w) => `${w.widgetId}(${JSON.stringify(w.params)})`,
        ),
        '| scope:',
        spaceSlug,
        `(${scope.source}, locked=${scope.locked})`,
        '| scopeCandidates:',
        (scopeCandidates ?? []).length,
        '| status:',
        status,
      );
    }

    const snap: Record<string, unknown> = {
      status,
      busy,
      msgCount: messages.length,
      spaceSlug,
      scopeSource: scope.source,
      locked: scope.locked,
      canvasKey: canvasState.updatedFromMessageId,
      widgetKeys: canvasState.widgets.map((w) => w.key).join('|'),
      nextActionsLen: nextActions.length,
      scopeCandidatesLen: (scopeCandidates ?? []).length,
      guidanceId: guidanceAction?.id,
    };
    if (d.count > 60 && !d.warned) {
      d.warned = true;
      const changed = Object.fromEntries(
        Object.entries(snap)
          .filter(([k, v]) => d.prev[k] !== v)
          .map(([k, v]) => [k, [d.prev[k], v]]),
      );
      console.warn(
        `[AssistantShell][DIAG] render burst: ${d.count} renders in ${
          now - d.windowStart
        }ms — changed:`,
        changed,
        'snap:',
        snap,
      );
    }
    d.prev = snap;
  }

  // Notify the host only once a turn settles — never mid-stream. A confused
  // model can call `set_scope` more than once in a turn (ping-ponging the
  // resolved space); propagating every intermediate value up to the host
  // would fan out into a host-owned refetch (guidance) per change and risks
  // a render-storm across two component trees while tokens are still
  // arriving. Settling to the final value avoids that regardless of how many
  // times it flip-flopped mid-turn.
  const lastNotifiedScopeRef = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (busy) return;
    if (lastNotifiedScopeRef.current === spaceSlug) return;
    lastNotifiedScopeRef.current = spaceSlug;
    // TEMP DIAG (#2486 M7)
    console.warn('[AssistantShell][DIAG] notify host scope →', spaceSlug);
    onActiveScopeChange?.(spaceSlug);
  }, [spaceSlug, onActiveScopeChange, busy]);

  const knownSpaces = React.useMemo(
    () =>
      (scopeCandidates ?? [])
        .filter((c) => c.slug)
        .map((c) => ({
          slug: c.slug,
          ...(c.title?.trim() ? { title: c.title.trim() } : {}),
        })),
    [scopeCandidates],
  );

  const [historyExpanded, setHistoryExpanded] = React.useState(false);

  const onNewConversation = React.useCallback(() => {
    setMessages([]);
    clearPersisted(sessionId);
    clearPersistedScope(sessionId);
    scope.setManualScope(null);
    scope.setLocked(false);
    setHistoryExpanded(false);
  }, [sessionId, setMessages, scope]);

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
        ...(knownSpaces.length > 0 ? { knownSpaces } : {}),
        scopeLocked: scope.locked,
      },
      ...extra,
    };
  }, [
    transport,
    spaceSlug,
    widgetCatalogue,
    widgetIds,
    knownSpaces,
    scope.locked,
  ]);

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

  const stripActions = React.useMemo(() => {
    const base = nextActions.length > 0 ? nextActions : greeting.nextActions;
    if (!guidanceAction) return base;
    // One guidance chip at a time — a model-set nudge wins over the host's.
    const hasGuidance = base.some(
      (a) => a.emphasis === 'guidance' || a.id === guidanceAction.id,
    );
    return hasGuidance ? base : [...base, guidanceAction];
  }, [nextActions, greeting.nextActions, guidanceAction]);

  return (
    <div className={cn('flex w-full flex-col', className)}>
      <div className="sticky top-0 z-20">
        <InteractionBar
          onSubmit={(text) => void submit(text)}
          busy={busy}
          disabled={false}
          modeToggleSlot={modeToggleSlot}
          scopeSlot={
            <ScopeSelector
              candidates={scopeCandidates ?? []}
              activeSpaceSlug={spaceSlug}
              locked={scope.locked}
              source={scope.source}
              onSelect={scope.setManualScope}
              onToggleLock={scope.setLocked}
            />
          }
          onNewConversation={hasConversation ? onNewConversation : undefined}
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
