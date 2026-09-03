'use client';

import { useMemo } from 'react';

import type {
  CanvasIntent,
  CanvasState,
  CanvasWidgetState,
  ConversationMessage,
  LayoutHint,
  NextAction,
  NextActionEmphasis,
  WidgetRegistry,
} from './types';
import { validateParams } from './validate-params';

export const EMPTY_CANVAS_STATE: CanvasState = {
  widgets: [],
  updatedFromMessageId: null,
};

const LAYOUT_HINTS: readonly LayoutHint[] = ['full', 'half', 'aside'];
const EMPHASES: readonly NextActionEmphasis[] = [
  'primary',
  'default',
  'guidance',
];

// ---------------------------------------------------------------------------
// Tool-part scan — mirrors `ai-tool-navigation.ts` (copied, not imported: that
// file is navigation-specific). Walks `message.parts` + legacy `toolInvocations`
// for completed `tool-<name>` outputs.
// ---------------------------------------------------------------------------

function isCompletedToolState(state: unknown): boolean {
  if (typeof state !== 'string') return true;
  return (
    state === 'output-available' ||
    state === 'output_available' ||
    state === 'done' ||
    state === 'completed'
  );
}

interface ToolResult {
  messageId: string;
  output: Record<string, unknown>;
}

/** Latest completed output for `toolName`, scanning newest message → oldest. */
function findLatestToolResult(
  messages: ConversationMessage[],
  toolName: string,
): ToolResult | null {
  for (let m = messages.length - 1; m >= 0; m -= 1) {
    const message = messages[m];
    if (!message) continue;
    const messageId = message.id ?? `m-${m}`;

    const parts = Array.isArray(message.parts) ? message.parts : [];
    for (let p = parts.length - 1; p >= 0; p -= 1) {
      const part = parts[p];
      if (!part || typeof part !== 'object') continue;
      const type = (part as { type?: unknown }).type;
      if (type !== `tool-${toolName}`) continue;
      if (!isCompletedToolState((part as { state?: unknown }).state)) continue;
      const output = (part as { output?: unknown }).output;
      if (output && typeof output === 'object') {
        return { messageId, output: output as Record<string, unknown> };
      }
    }

    const invocations = Array.isArray(message.toolInvocations)
      ? message.toolInvocations
      : [];
    for (let i = invocations.length - 1; i >= 0; i -= 1) {
      const inv = invocations[i];
      if (!inv || typeof inv !== 'object') continue;
      const name =
        (inv as { toolName?: unknown }).toolName ??
        (inv as { tool?: unknown }).tool;
      if (name !== toolName) continue;
      if (!isCompletedToolState((inv as { state?: unknown }).state)) continue;
      const output =
        (inv as { result?: unknown }).result ??
        (inv as { output?: unknown }).output;
      if (output && typeof output === 'object') {
        return { messageId, output: output as Record<string, unknown> };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Extraction — tool output → typed intents / actions
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Reads `{ ok, canvas: [...] }` — the `set_canvas` echo. Accepts both the
 * normalised `canvas` array and the raw `widgets` input as a fallback.
 */
export function extractCanvasIntents(
  output: Record<string, unknown> | undefined,
): CanvasIntent[] {
  if (!output || output.ok === false) return [];
  const raw = Array.isArray(output.canvas)
    ? output.canvas
    : Array.isArray(output.widgets)
    ? output.widgets
    : [];

  const intents: CanvasIntent[] = [];
  for (const entry of raw) {
    const record = asRecord(entry);
    if (!record) continue;
    const widgetId =
      typeof record.widgetId === 'string'
        ? record.widgetId
        : typeof record.widget_id === 'string'
        ? record.widget_id
        : '';
    if (!widgetId) continue;
    const params = asRecord(record.params) ?? {};
    const hint =
      typeof record.layoutHint === 'string'
        ? record.layoutHint
        : typeof record.layout_hint === 'string'
        ? record.layout_hint
        : undefined;
    intents.push({
      widgetId,
      params,
      layoutHint: LAYOUT_HINTS.includes(hint as LayoutHint)
        ? (hint as LayoutHint)
        : undefined,
      key: typeof record.key === 'string' ? record.key : undefined,
    });
  }
  return intents;
}

/** Reads `{ ok, actions: [...] }` — the `set_next_actions` echo. */
export function extractNextActions(
  output: Record<string, unknown> | undefined,
): NextAction[] {
  if (!output || output.ok === false) return [];
  const raw = Array.isArray(output.actions) ? output.actions : [];

  const actions: NextAction[] = [];
  for (const entry of raw) {
    const record = asRecord(entry);
    if (!record) continue;
    const label = typeof record.label === 'string' ? record.label : '';
    if (!label) continue;
    const id =
      typeof record.id === 'string' && record.id
        ? record.id
        : `na-${actions.length}`;
    const emphasis = EMPHASES.includes(record.emphasis as NextActionEmphasis)
      ? (record.emphasis as NextActionEmphasis)
      : undefined;
    actions.push({
      id,
      label,
      prompt: typeof record.prompt === 'string' ? record.prompt : undefined,
      href: typeof record.href === 'string' ? record.href : undefined,
      emphasis,
    });
  }
  return actions;
}

// ---------------------------------------------------------------------------
// Reducer (#2486 §4.1) — replace-all, dedupe by key, drop invalid, keep last-good
// ---------------------------------------------------------------------------

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}

function intentKey(intent: CanvasIntent): string {
  return intent.key ?? `${intent.widgetId}:${stableStringify(intent.params)}`;
}

/**
 * `reduceCanvas(prev, intents, registry)` — the model declares the full desired
 * set each `set_canvas`. Unknown `widgetId` or failed schema validation drops
 * that intent (logged) and keeps the rest. An empty resulting set keeps `prev`
 * (last-good — an errored or empty turn never blanks the canvas, §3).
 */
export function reduceCanvas(
  prev: CanvasState,
  intents: CanvasIntent[],
  registry: WidgetRegistry,
  messageId?: string | null,
): CanvasState {
  const seen = new Set<string>();
  const widgets: CanvasWidgetState[] = [];

  for (const intent of intents) {
    const def = registry.get(intent.widgetId);
    if (!def) {
      console.warn(`[use-canvas] dropping unknown widget "${intent.widgetId}"`);
      continue;
    }
    const validation = validateParams(def.paramsSchema, intent.params);
    if (!validation.ok) {
      console.warn(
        `[use-canvas] dropping "${
          intent.widgetId
        }" — invalid params: ${validation.issues.join('; ')}`,
      );
      continue;
    }
    const key = intentKey(intent);
    if (seen.has(key)) continue;
    seen.add(key);
    widgets.push({
      widgetId: intent.widgetId,
      params: validation.value as Record<string, unknown>,
      key,
      layoutHint: intent.layoutHint,
    });
  }

  if (widgets.length === 0) return prev;
  return {
    widgets,
    updatedFromMessageId: messageId ?? prev.updatedFromMessageId,
  };
}

/**
 * Replays the reducer over every completed `set_canvas` in order (oldest →
 * newest). Deriving from `messages` means a reload reconstructs the canvas
 * without separate persistence (§6.5), and last-good survives an empty turn.
 */
export function selectCanvasState(
  messages: ConversationMessage[],
  registry: WidgetRegistry,
): CanvasState {
  const calls: ToolResult[] = [];
  // findLatestToolResult only returns the newest; walk explicitly for all.
  for (let m = 0; m < messages.length; m += 1) {
    const message = messages[m];
    if (!message) continue;
    const messageId = message.id ?? `m-${m}`;
    const parts = Array.isArray(message.parts) ? message.parts : [];
    for (const part of parts) {
      if (!part || typeof part !== 'object') continue;
      if ((part as { type?: unknown }).type !== 'tool-set_canvas') continue;
      if (!isCompletedToolState((part as { state?: unknown }).state)) continue;
      const output = (part as { output?: unknown }).output;
      if (output && typeof output === 'object') {
        calls.push({ messageId, output: output as Record<string, unknown> });
      }
    }
  }

  return calls.reduce<CanvasState>(
    (acc, call) =>
      reduceCanvas(
        acc,
        extractCanvasIntents(call.output),
        registry,
        call.messageId,
      ),
    EMPTY_CANVAS_STATE,
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseCanvasResult {
  canvasState: CanvasState;
  nextActions: NextAction[];
}

/**
 * Scans `messages` for completed `tool-set_canvas` / `tool-set_next_actions`
 * outputs and reduces them to `{ canvasState, nextActions }`.
 */
export function useCanvas(
  messages: ConversationMessage[],
  registry: WidgetRegistry,
): UseCanvasResult {
  return useMemo(() => {
    const canvasState = selectCanvasState(messages, registry);
    const actionsResult = findLatestToolResult(messages, 'set_next_actions');
    const nextActions = actionsResult
      ? extractNextActions(actionsResult.output)
      : [];
    return { canvasState, nextActions };
  }, [messages, registry]);
}
