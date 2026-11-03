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

/** Signal @ list is the team, including people the space roster has not mapped yet. */
export function mentionCandidatesForSignalTeam({
  roster,
  teamMemberIds,
  currentUserId,
  labelFor,
}: {
  roster: ChatMentionCandidate[];
  teamMemberIds: readonly string[];
  currentUserId: string | null;
  labelFor: (userId: string) => string;
}): ChatMentionCandidate[] {
  const self = currentUserId?.trim() || null;
  const team = new Set(
    teamMemberIds.map((id) => id.trim()).filter((id) => id && id !== self),
  );
  const byUserId = new Map<string, ChatMentionCandidate>();
  for (const candidate of roster) {
    const userId = candidate.userId.trim();
    if (!team.has(userId)) continue;
    byUserId.set(userId, candidate);
  }
  for (const userId of team) {
    if (byUserId.has(userId)) continue;
    byUserId.set(userId, {
      userId,
      displayLabel: labelFor(userId),
    });
  }
  return [...byUserId.values()].sort((a, b) =>
    a.displayLabel.localeCompare(b.displayLabel, undefined, {
      sensitivity: 'base',
    }),
  );
}

export type SignalTeamRosterMember = {
  personId: number;
  matrixUserId: string | null;
  displayLabel: string;
  avatarUrl?: string;
};

/** Full space roster for Signal Team manage UI — includes members without a Matrix link. */
export function buildSpaceRosterSignalTeamMembers({
  spaceMembers,
  personIdToMatrixUserId,
  unknownLabel,
}: {
  spaceMembers: Person[];
  personIdToMatrixUserId: Record<number, string>;
  unknownLabel: string;
}): SignalTeamRosterMember[] {
  return spaceMembers
    .map((member) => ({
      personId: member.id,
      matrixUserId: personIdToMatrixUserId[member.id]?.trim() || null,
      displayLabel: personRosterDisplayLabel(member, unknownLabel),
      avatarUrl: member.avatarUrl ?? undefined,
    }))
    .sort((a, b) =>
      a.displayLabel.localeCompare(b.displayLabel, undefined, {
        sensitivity: 'base',
      }),
    );
}
