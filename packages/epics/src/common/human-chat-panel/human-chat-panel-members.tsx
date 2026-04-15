'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Skeleton } from '@hypha-platform/ui';
import { useMatrix } from '@hypha-platform/core/client';
import { PersonAvatar } from '../../people/components/person-avatar';
import { UseMembers } from '../../spaces';

type HumanChatPanelMembersProps = {
  useMembers: UseMembers;
  spaceSlug?: string;
  /** Active Matrix room for presence (space or coherence chat). */
  roomId?: string | null;
};

export function HumanChatPanelMembers({
  useMembers,
  spaceSlug,
  roomId,
}: HumanChatPanelMembersProps) {
  const t = useTranslations('HumanChatPanel');
  const { getRoomMembers, isMatrixAvailable, isAuthenticated } = useMatrix();
  const [onlineCount, setOnlineCount] = useState(0);

  const { persons, isLoading } = useMembers({
    spaceSlug,
    paginationDisabled: true,
  });

  const members = persons?.data ?? [];
  const totalCount = persons?.pagination?.total ?? members.length;

  useEffect(() => {
    if (!roomId || !isMatrixAvailable || !isAuthenticated) {
      setOnlineCount(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const matrixMembers = await getRoomMembers(roomId);
        if (cancelled) return;
        setOnlineCount(matrixMembers.filter((m) => m.presence).length);
      } catch {
        if (!cancelled) setOnlineCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, isMatrixAvailable, isAuthenticated, getRoomMembers]);

  return (
    <div
      className="flex flex-col gap-1 px-3 py-3"
      data-testid="chat-panel-members"
    >
      <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">
        {t('membersCount', {
          count: totalCount,
          online: onlineCount,
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
      {!isLoading && members.length === 0 && (
        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
          {t('noMembers')}
        </div>
      )}
      {members.map((member) => {
        const displayName =
          [member.name, member.surname].filter(Boolean).join(' ') ||
          member.nickname ||
          t('unknownMember');

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
