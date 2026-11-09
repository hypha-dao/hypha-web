import type { QuestStewardStep } from '@hypha-platform/core/client';
import type { SpaceQuestDraftChatMessage } from '../../common/human-chat-panel-context';
import type { PendingQuestSectionProposal } from './quest-draft-assistant';

export type QuestHelperSession = {
  messages: SpaceQuestDraftChatMessage[];
  pending: PendingQuestSectionProposal | null;
  step: number;
};

const MAX_MESSAGES = 40;

export function questHelperSessionKey(
  spaceSlug: string,
  questSlug: string,
): string {
  return `hypha-quest-helper:${spaceSlug}:${questSlug}`;
}

type StoredMessage = {
  id: string;
  role: 'user' | 'member';
  text: string;
  timestamp: string;
  senderName?: string;
  avatarUrl?: string;
};

function isStep(value: unknown): value is QuestStewardStep {
  return (
    value === 'goal' ||
    value === 'scope' ||
    value === 'success' ||
    value === 'milestones' ||
    value === 'members' ||
    value === 'lead' ||
    value === 'targetDate' ||
    value === 'rewards' ||
    value === 'name'
  );
}

export function readQuestHelperSession(
  storage: Pick<Storage, 'getItem'> | null | undefined,
  key: string,
): QuestHelperSession | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      messages?: StoredMessage[];
      pending?: PendingQuestSectionProposal | null;
      step?: number;
    };
    const messages = (parsed.messages ?? [])
      .filter(
        (message) =>
          message &&
          (message.role === 'user' || message.role === 'member') &&
          typeof message.text === 'string' &&
          typeof message.id === 'string',
      )
      .slice(-MAX_MESSAGES)
      .map((message) => ({
        id: message.id,
        role: message.role,
        text: message.text,
        timestamp: new Date(message.timestamp),
        ...(message.senderName ? { senderName: message.senderName } : {}),
        ...(message.avatarUrl ? { avatarUrl: message.avatarUrl } : {}),
      }));
    if (messages.length === 0) return null;
    const pending =
      parsed.pending &&
      isStep(parsed.pending.step) &&
      parsed.pending.patch &&
      typeof parsed.pending.patch === 'object'
        ? parsed.pending
        : null;
    const step =
      typeof parsed.step === 'number' && parsed.step >= 0 ? parsed.step : 0;
    return { messages, pending, step };
  } catch {
    return null;
  }
}

export function writeQuestHelperSession(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  key: string,
  session: QuestHelperSession,
): void {
  if (!storage) return;
  try {
    const messages = session.messages.slice(-MAX_MESSAGES).map((message) => ({
      id: message.id,
      role: message.role,
      text: message.text,
      timestamp: message.timestamp.toISOString(),
      ...(message.senderName ? { senderName: message.senderName } : {}),
      ...(message.avatarUrl ? { avatarUrl: message.avatarUrl } : {}),
    }));
    storage.setItem(
      key,
      JSON.stringify({
        messages,
        pending: session.pending,
        step: session.step,
      }),
    );
  } catch {
    // A full or blocked session store still leaves the live thread intact.
  }
}
