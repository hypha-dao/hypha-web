import type { Person } from '@hypha-platform/core/client';

import type { ChatMentionCandidate } from './human-chat-panel-chat-bar';

export function personRosterDisplayLabel(
  person: Person,
  unknownLabel: string,
): string {
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (person.nickname?.trim()) return person.nickname.trim();
  return unknownLabel;
}

/** Space members with a linked Matrix id — same source as the Members tab roster. */
export function buildSpaceRosterMentionCandidates({
  spaceMembers,
  personIdToMatrixUserId,
  unknownLabel,
  extraCandidates = [],
}: {
  spaceMembers: Person[];
  personIdToMatrixUserId: Record<number, string>;
  unknownLabel: string;
  extraCandidates?: ChatMentionCandidate[];
}): ChatMentionCandidate[] {
  const byUserId = new Map<string, ChatMentionCandidate>();

  for (const candidate of extraCandidates) {
    const userId = candidate.userId.trim();
    if (!userId) continue;
    byUserId.set(userId, candidate);
  }

  for (const member of spaceMembers) {
    const userId = personIdToMatrixUserId[member.id]?.trim();
    if (!userId) continue;
    byUserId.set(userId, {
      userId,
      displayLabel: personRosterDisplayLabel(member, unknownLabel),
      avatarUrl: member.avatarUrl ?? undefined,
    });
  }

  return [...byUserId.values()].sort((a, b) =>
    a.displayLabel.localeCompare(b.displayLabel, undefined, {
      sensitivity: 'base',
    }),
  );
}
