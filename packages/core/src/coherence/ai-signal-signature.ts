/**
 * An AI-written signal is signed in chat by the agent, not by whoever
 * happens to open the thread. The thread used to post the description
 * from the viewer's Matrix account, so it showed up as them.
 */

export type AiSignalTimelineEvent = {
  eventId: string;
  sender: string;
  body: string;
  timestamp: number;
  msgtype?: string;
  redacted?: boolean;
  replacement?: boolean;
};

const SIGNAL_TEAM_MARKERS = [
  '[hypha:signal-team]',
  '[hypha:signal-team-request]',
];

export function isAiAuthoredSignal(input: {
  tags?: readonly string[] | null;
  title?: string | null;
  description?: string | null;
}): boolean {
  if (
    (input.tags ?? []).some((tag) => tag.trim().toLowerCase() === 'ai signal')
  ) {
    return true;
  }
  const title = input.title?.trim().toLowerCase() ?? '';
  if (title.startsWith('high-signal ') && title.includes(' update')) {
    return true;
  }
  return (input.description ?? '')
    .toLowerCase()
    .includes(
      'recent space-memory activity indicates a coordination opportunity',
    );
}

export function normalizeSignalSignatureText(value: string): string {
  return value.replace(/\u00A0/g, ' ').trim();
}

export function planAiSignalChatSignature(input: {
  description: string;
  botUserId: string;
  events: AiSignalTimelineEvent[];
}): { send: boolean; redactEventId: string | null } {
  const description = normalizeSignalSignatureText(input.description);
  const botUserId = input.botUserId.trim();
  if (!description || !botUserId) {
    return { send: false, redactEventId: null };
  }

  const texts = input.events
    .filter((event) => {
      if (event.redacted || event.replacement) return false;
      if (!event.eventId.trim() || !event.sender.trim()) return false;
      if (event.msgtype && event.msgtype !== 'm.text') return false;
      const body = event.body.trim();
      if (!body) return false;
      return !SIGNAL_TEAM_MARKERS.some((marker) => body.startsWith(marker));
    })
    .sort(
      (a, b) => a.timestamp - b.timestamp || a.eventId.localeCompare(b.eventId),
    );

  const alreadySigned = texts.some(
    (event) =>
      event.sender === botUserId &&
      normalizeSignalSignatureText(event.body) === description,
  );
  const earliest = texts[0];
  if (!earliest) {
    return { send: true, redactEventId: null };
  }

  const earliestIsDescription =
    normalizeSignalSignatureText(earliest.body) === description;
  if (!earliestIsDescription) {
    return { send: false, redactEventId: null };
  }

  return {
    send: !alreadySigned,
    redactEventId: earliest.sender === botUserId ? null : earliest.eventId,
  };
}
