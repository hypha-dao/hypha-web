'use client';

import {
  QUEST_MILESTONE_STATUSES,
  type QuestMilestoneStatus,
} from '@hypha-platform/core/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

export function QuestMilestoneStatusSelect({
  value,
  onChange,
  disabled = false,
  ariaLabel,
  testId,
  className,
}: {
  value: QuestMilestoneStatus;
  onChange: (status: QuestMilestoneStatus) => void;
  disabled?: boolean;
  ariaLabel?: string;
  testId?: string;
  className?: string;
}) {
  const t = useTranslations('SpaceQuests');
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if ((QUEST_MILESTONE_STATUSES as readonly string[]).includes(next)) {
          onChange(next as QuestMilestoneStatus);
        }
      }}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        data-testid={testId}
        className={cn(
          'h-10 rounded-none bg-background px-3 text-[11px] font-semibold',
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {QUEST_MILESTONE_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {t(`milestones.status.${status}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
