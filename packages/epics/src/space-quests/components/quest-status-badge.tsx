import {
  isRejectedProposedQuest,
  type QuestRecord,
  type QuestStatus,
} from '@hypha-platform/core/client';
import { Badge } from '@hypha-platform/ui';
import {
  OUTLINED_LIST_TAG_SIZE,
  OUTLINED_LIST_TAG_VARIANT,
  type OutlinedListTagColor,
} from '../../common/outlined-list-tag';

function statusLabel(status: QuestStatus): string {
  switch (status) {
    case 'proposed':
      return 'Proposed';
    case 'paused':
      return 'Paused';
    case 'completed':
      return 'Completed';
    case 'archived':
      return 'Archived';
    default:
      return 'Active';
  }
}

export function questStatusTag(
  quest: Pick<QuestRecord, 'status' | 'proposalStatus'>,
): string {
  if (isRejectedProposedQuest(quest)) return 'Rejected';
  return statusLabel(quest.status);
}

function questStatusColor(
  quest: Pick<QuestRecord, 'status' | 'proposalStatus'>,
): OutlinedListTagColor {
  if (isRejectedProposedQuest(quest)) return 'error';
  switch (quest.status) {
    case 'active':
      return 'success';
    case 'paused':
      return 'warn';
    case 'proposed':
      return 'accent';
    default:
      return 'neutral';
  }
}

/** Same outline Badge the signal list uses for its tags. */
export function QuestStatusBadge({
  quest,
}: {
  quest: Pick<QuestRecord, 'status' | 'proposalStatus'>;
}) {
  return (
    <Badge
      variant={OUTLINED_LIST_TAG_VARIANT}
      size={OUTLINED_LIST_TAG_SIZE}
      colorVariant={questStatusColor(quest)}
    >
      {questStatusTag(quest)}
    </Badge>
  );
}
