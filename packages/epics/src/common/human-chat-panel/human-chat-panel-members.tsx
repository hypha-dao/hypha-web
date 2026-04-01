'use client';

import { useTranslations } from 'next-intl';
import { Skeleton } from '@hypha-platform/ui';
import { PersonAvatar } from '../../people/components/person-avatar';
import { UseMembers } from '../../spaces';

type HumanChatPanelMembersProps = {
  useMembers: UseMembers;
  spaceSlug?: string;
};

export function HumanChatPanelMembers({
  useMembers,
  spaceSlug,
}: HumanChatPanelMembersProps) {
  const t = useTranslations('HumanChatPanel');

  const { persons, isLoading } = useMembers({
    spaceSlug,
    paginationDisabled: true,
  });

  const members = persons?.data ?? [];
  const totalCount = persons?.pagination?.total ?? members.length;

  return (
    <div
      className="flex flex-col gap-1 px-3 py-3"
      data-testid="chat-panel-members"
    >
      <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">
        {t('membersCount', {
          count: totalCount,
          online: 0,
        })}
      </div>
      {isLoading && members.length === 0 && (
        <div className="flex flex-col gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-md px-2 py-1.5"
            >
              <PersonAvatar isLoading size="md" />
              <Skeleton width="120px" height="16px" loading>
                <div />
              </Skeleton>
            </div>
          ))}
        </div>
      )}
      {members.map((member) => {
        const displayName =
          [member.name, member.surname].filter(Boolean).join(' ') ||
          member.nickname ||
          'Unknown';

        return (
          <div
            key={member.slug ?? member.id}
            className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
            data-testid="chat-panel-member-item"
          >
            <PersonAvatar
              avatarSrc={member.avatarUrl}
              userName={displayName}
              size="md"
            />
            <span className="text-sm text-foreground truncate">
              {displayName}
            </span>
          </div>
        );
      })}
    </div>
  );
}
