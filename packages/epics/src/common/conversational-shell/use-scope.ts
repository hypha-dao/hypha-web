'use client';

import * as React from 'react';

import type { ConversationMessage, ScopeState } from './types';

/**
 * Conversational scope (#2486 M7).
 *
 * Scope = which space every turn targets. Three inputs, highest "order" wins:
 *  1. **manual** — the member's selector pick (persisted per session).
 *  2. **model** — the latest completed `set_scope` tool output (ignored while
 *     `locked`).
 *  3. **seed** — `scopeResolver` (recent spaces), used until 1 or 2 fire.
 *
 * "order" places manual picks at the live end of the conversation
 * (`messages.length` at pick time) and model `set_scope` at its message index,
 * so a later `set_scope` beats an earlier manual pick (collaborative) — unless
 * `locked`, where only the member moves scope.
 *
 * Derives from `messages` + a small persisted pref, mirroring `use-canvas`:
 * a reload reconstructs scope with no extra bookkeeping.
 */

const SCOPE_PERSIST_PREFIX = 'hypha:assistant:scope:v1:';

interface ScopePref {
  manualSlug: string | null;
  /** `messages.length` when the member picked; orders against model events. */
  manualOrder: number;
  locked: boolean;
}

const DEFAULT_PREF: ScopePref = {
  manualSlug: null,
  manualOrder: 0,
  locked: false,
};

function loadPref(sessionId: string): ScopePref {
  if (typeof window === 'undefined') return DEFAULT_PREF;
  try {
    const raw = window.localStorage.getItem(
      `${SCOPE_PERSIST_PREFIX}${sessionId}`,
    );
    if (!raw) return DEFAULT_PREF;
    const parsed = JSON.parse(raw) as Partial<ScopePref>;
    return {
      manualSlug:
        typeof parsed.manualSlug === 'string' ? parsed.manualSlug : null,
      manualOrder:
        typeof parsed.manualOrder === 'number' && parsed.manualOrder >= 0
          ? parsed.manualOrder
          : 0,
      locked: parsed.locked === true,
    };
  } catch {
    return DEFAULT_PREF;
  }
}

function persistPref(sessionId: string, pref: ScopePref): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `${SCOPE_PERSIST_PREFIX}${sessionId}`,
      JSON.stringify(pref),
    );
  } catch {
    // ignore quota / private mode
  }
}

/** Clears the persisted scope pref (used by "new conversation"). */
export function clearPersistedScope(sessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`${SCOPE_PERSIST_PREFIX}${sessionId}`);
  } catch {
    // ignore
  }
}

function isCompletedToolState(state: unknown): boolean {
  if (typeof state !== 'string') return true;
  return (
    state === 'output-available' ||
    state === 'output_available' ||
    state === 'done' ||
    state === 'completed'
  );
}

interface ModelScopeEvent {
  slug: string;
  order: number;
}

/** Latest completed `set_scope` output across the message array (oldest→newest). */
export function selectModelScopeEvent(
  messages: ConversationMessage[],
): ModelScopeEvent | null {
  let latest: ModelScopeEvent | null = null;
  for (let m = 0; m < messages.length; m += 1) {
    const message = messages[m];
    if (!message) continue;
    const parts = Array.isArray(message.parts) ? message.parts : [];
    for (const part of parts) {
      if (!part || typeof part !== 'object') continue;
      if ((part as { type?: unknown }).type !== 'tool-set_scope') continue;
      if (!isCompletedToolState((part as { state?: unknown }).state)) continue;
      const output = (part as { output?: unknown }).output;
      if (!output || typeof output !== 'object') continue;
      if ((output as { ok?: unknown }).ok === false) continue;
      const slug =
        typeof (output as { spaceSlug?: unknown }).spaceSlug === 'string'
          ? ((output as { spaceSlug: string }).spaceSlug || '').trim()
          : '';
      if (!slug) continue;
      latest = { slug, order: m };
    }
  }
  return latest;
}

export interface UseScopeOptions {
  /** `config.scopeResolver` result — the recent-spaces seed. */
  seedSlug?: string;
  /** Stable id shared with `useChat` persistence. */
  sessionId: string;
}

/**
 * Resolves `{ activeSpaceSlug, locked, source }` and the two setters.
 * Pure over `messages` + the persisted pref.
 */
export function useScope(
  messages: ConversationMessage[],
  { seedSlug, sessionId }: UseScopeOptions,
): ScopeState {
  const [pref, setPref] = React.useState<ScopePref>(() => loadPref(sessionId));

  // Re-hydrate if the session id changes under us.
  const sessionRef = React.useRef(sessionId);
  React.useEffect(() => {
    if (sessionRef.current === sessionId) return;
    sessionRef.current = sessionId;
    setPref(loadPref(sessionId));
  }, [sessionId]);

  React.useEffect(() => {
    persistPref(sessionId, pref);
  }, [sessionId, pref]);

  const modelEvent = React.useMemo(
    () => selectModelScopeEvent(messages),
    [messages],
  );

  const messageCount = messages.length;

  const setManualScope = React.useCallback(
    (slug: string | null) => {
      setPref((prev) => ({
        ...prev,
        manualSlug: slug && slug.trim() ? slug.trim() : null,
        manualOrder: messageCount,
      }));
    },
    [messageCount],
  );

  const setLocked = React.useCallback((locked: boolean) => {
    setPref((prev) => ({ ...prev, locked }));
  }, []);

  const { activeSpaceSlug, source } = React.useMemo<{
    activeSpaceSlug: string | undefined;
    source: ScopeState['source'];
  }>(() => {
    const candidates: Array<{
      slug: string;
      order: number;
      source: ScopeState['source'];
    }> = [];

    if (pref.manualSlug) {
      candidates.push({
        slug: pref.manualSlug,
        order: pref.manualOrder,
        source: 'manual',
      });
    }
    if (!pref.locked && modelEvent) {
      candidates.push({
        slug: modelEvent.slug,
        order: modelEvent.order,
        source: 'model',
      });
    }

    if (candidates.length === 0) {
      return {
        activeSpaceSlug: seedSlug?.trim() || undefined,
        source: seedSlug?.trim() ? 'seed' : 'none',
      };
    }

    const winner = candidates.reduce((a, b) => (b.order >= a.order ? b : a));
    return { activeSpaceSlug: winner.slug, source: winner.source };
  }, [pref.manualSlug, pref.manualOrder, pref.locked, modelEvent, seedSlug]);

  return {
    activeSpaceSlug,
    locked: pref.locked,
    source,
    setManualScope,
    setLocked,
  };
}
