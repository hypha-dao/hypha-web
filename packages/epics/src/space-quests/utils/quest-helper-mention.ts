import { QUEST_HELPER_NAME } from '@hypha-platform/core/client';

/** Composer-only id. It is not a Matrix user, so send must not rewrite it to an MXID. */
export const QUEST_HELPER_MENTION_ID = 'quest-helper';

type MentionRow = {
  userId: string;
  displayLabel: string;
  rowKey?: string;
};

/** Space, network, or context mark. Kept wide so the picker icon can grow. */
type MentionIcon = { kind: string; logoUrl?: string | null };

/**
 * Quest Helper sits with AI Agents in a quest room's @ picker.
 * Other rooms are unchanged.
 */
export function withQuestHelperMention<T extends MentionRow>(
  candidates: readonly T[],
  enabled: boolean,
  icon?: MentionIcon,
): T[] {
  if (!enabled) return [...candidates];
  if (
    candidates.some(
      (candidate) =>
        candidate.userId === QUEST_HELPER_MENTION_ID ||
        candidate.rowKey === 'quest-helper',
    )
  ) {
    return [...candidates];
  }
  const row = {
    userId: QUEST_HELPER_MENTION_ID,
    displayLabel: QUEST_HELPER_NAME,
    rowKey: 'quest-helper',
    agentIcon: icon ?? { kind: 'network' },
  } as unknown as T;
  const agentAt = candidates.findIndex(
    (candidate) => candidate.rowKey === 'agent',
  );
  if (agentAt < 0) return [row, ...candidates];
  return [
    ...candidates.slice(0, agentAt + 1),
    row,
    ...candidates.slice(agentAt + 1),
  ];
}
