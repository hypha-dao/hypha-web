import type { UIMessage } from 'ai';

const THREAD_KEY = 'hypha-member-home-thread';
const RETURN_KEY = 'hypha-member-home-return';
const ACTED_KEY = 'hypha-member-home-acted';
const CHOICES_KEY = 'hypha-member-home-choices';

/** Same-tab signal. Storage events do not fire in the tab that wrote them. */
export const HOME_QUEUE_EVENT = 'hypha-member-home-queue';
/** Ask the home to load again after the member acts. */
export const HOME_REFRESH_EVENT = 'hypha-member-home-refresh';

function notifyHomeQueue() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(HOME_QUEUE_EVENT));
}

export function requestHomeRefresh() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(HOME_REFRESH_EVENT));
}

/** Hidden line. The member never sees it. The assistant continues from it. */
export function homeReturnText(title: string) {
  const name = title.trim() || 'that';
  return `I carried out the recommended action on "${name}". Continue with the next.`;
}

function readList(key: string) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed
          .filter((item): item is string => typeof item === 'string')
          .slice(0, 80)
      : [];
  } catch {
    return [];
  }
}

/** They acted on this item and stayed. Coming back should not continue twice. */
export function markHomeActed(key: string) {
  if (typeof window === 'undefined') return;
  const itemKey = key.trim();
  if (!itemKey) return;
  try {
    const acted = readList(ACTED_KEY);
    if (!acted.includes(itemKey)) acted.push(itemKey);
    window.sessionStorage.setItem(ACTED_KEY, JSON.stringify(acted.slice(-80)));
    notifyHomeQueue();
    requestHomeRefresh();
  } catch {
    // The next message still has the transcript when storage is blocked.
  }
}

/** The member left to do this item. Coming back continues the thread. */
export function rememberHomeAction(key: string, title: string) {
  if (typeof window === 'undefined') return;
  const itemKey = key.trim();
  if (!itemKey) return;
  try {
    const acted = readList(ACTED_KEY);
    if (!acted.includes(itemKey)) acted.push(itemKey);
    window.sessionStorage.setItem(ACTED_KEY, JSON.stringify(acted.slice(-80)));
    window.sessionStorage.setItem(
      RETURN_KEY,
      JSON.stringify({ title: title.trim() }),
    );
    notifyHomeQueue();
    requestHomeRefresh();
  } catch {
    // The next visit still has the transcript when storage is blocked.
  }
}

export function readHomeActed() {
  return readList(ACTED_KEY);
}

export function readHomeChoices(): {
  passed: string[];
  deferred: string[];
  settled: string[];
} {
  if (typeof window === 'undefined') {
    return { passed: [], deferred: [], settled: [] };
  }
  try {
    const raw = window.localStorage.getItem(CHOICES_KEY);
    if (!raw) return { passed: [], deferred: [], settled: [] };
    const parsed = JSON.parse(raw) as {
      passed?: unknown;
      deferred?: unknown;
      settled?: unknown;
    };
    const list = (value: unknown) =>
      Array.isArray(value)
        ? value
            .filter((item): item is string => typeof item === 'string')
            .slice(0, 80)
        : [];
    return {
      passed: list(parsed.passed),
      deferred: list(parsed.deferred),
      settled: list(parsed.settled),
    };
  } catch {
    return { passed: [], deferred: [], settled: [] };
  }
}

export function writeHomeChoices(choices: {
  passed: string[];
  deferred: string[];
  settled: string[];
}) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CHOICES_KEY, JSON.stringify(choices));
    notifyHomeQueue();
  } catch {
    // The conversation still carries the choice when storage is blocked.
  }
}

/** One return, then the flag is gone so a later visit does not continue twice. */
export function consumeHomeReturn() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(RETURN_KEY);
    window.sessionStorage.removeItem(RETURN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { title?: unknown };
    return typeof parsed.title === 'string' ? parsed.title : '';
  } catch {
    return null;
  }
}

export function readHomeThread(): UIMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(THREAD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((message) => {
      if (!message || typeof message !== 'object') return [];
      const row = message as {
        id?: unknown;
        role?: unknown;
        parts?: unknown;
        metadata?: unknown;
      };
      if (
        (row.role !== 'user' && row.role !== 'assistant') ||
        typeof row.id !== 'string' ||
        !Array.isArray(row.parts)
      ) {
        return [];
      }
      const parts = row.parts.flatMap((part) => {
        if (!part || typeof part !== 'object') return [];
        const text = part as { type?: unknown; text?: unknown };
        if (text.type !== 'text' || typeof text.text !== 'string') return [];
        return [{ type: 'text' as const, text: text.text }];
      });
      if (parts.length === 0) return [];
      return [
        {
          id: row.id,
          role: row.role,
          parts,
          metadata:
            row.metadata && typeof row.metadata === 'object'
              ? (row.metadata as UIMessage['metadata'])
              : undefined,
        },
      ];
    });
  } catch {
    return [];
  }
}

export function writeHomeThread(messages: readonly UIMessage[]) {
  if (typeof window === 'undefined' || messages.length === 0) return;
  try {
    const stored = messages.slice(-40).map((message) => ({
      id: message.id,
      role: message.role,
      metadata: message.metadata,
      parts: (message.parts ?? []).flatMap((part) =>
        part.type === 'text'
          ? [{ type: 'text' as const, text: part.text }]
          : [],
      ),
    }));
    window.sessionStorage.setItem(THREAD_KEY, JSON.stringify(stored));
  } catch {
    // The live thread still shows for this visit.
  }
}
