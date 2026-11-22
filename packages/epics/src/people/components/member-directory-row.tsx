'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { MemberConnectActions } from './member-card';
import { PersonAvatar } from './person-avatar';
import { MemberSpaceIcons, usePersonMemberSpaces } from './member-space-icons';

const NEW_MEMBER_MS = 30 * 24 * 60 * 60 * 1000;

export function MemberDirectoryRow({
  name,
  surname,
  nickname,
  slug,
  avatarUrl,
  address,
  id,
  joinedAt,
  isLoading,
  onChat,
  onCall,
  onVideo,
}: {
  name?: string;
  surname?: string;
  nickname?: string;
  slug?: string;
  avatarUrl?: string;
  address?: string;
  id?: number;
  joinedAt?: string | null;
  isLoading?: boolean;
  onChat?: () => void;
  onCall?: () => void;
  onVideo?: () => void;
}) {
  const t = useTranslations('MembersTab');
  const tCommon = useTranslations('Common');
  const tHome = useTranslations('MemberHome');
  const format = useFormatter();
  const params = useParams<{ id?: string }>();
  const spaceSlug = typeof params.id === 'string' ? params.id : '';
  const { space } = useSpaceBySlug(spaceSlug);
  const { spaces } = usePersonMemberSpaces({
    personAddress: address,
    personSlug: slug,
  });
  const displayName =
    [name, surname].filter(Boolean).join(' ').trim() ||
    nickname ||
    tCommon('memberRoleLabel');
  const joined = useMemo(() => {
    if (!joinedAt) return null;
    const date = new Date(joinedAt);
    if (Number.isNaN(date.getTime())) return null;
    return {
      label: t('joinedIn', {
        space: space?.title || space?.slug || '',
        date: format.dateTime(date, { month: 'short', year: 'numeric' }),
      }),
      isNew: Date.now() - date.getTime() <= NEW_MEMBER_MS,
    };
  }, [format, joinedAt, space?.slug, space?.title, t]);
  const spaceIcons = spaces.map((item) => ({
    slug: item.slug,
    title: item.title,
    logoUrl: item.logoUrl,
  }));

  if (isLoading) {
    return <div className="h-20 border-b border-border" aria-hidden />;
  }

  return (
    <article
      className="flex gap-3 border-b border-border py-4"
      onClick={() => onChat?.()}
      onKeyDown={(event) => {
        if (!onChat || event.target !== event.currentTarget) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onChat();
      }}
      role={onChat ? 'button' : undefined}
      tabIndex={onChat ? 0 : undefined}
    >
      <PersonAvatar
        avatarSrc={avatarUrl}
        userName={nickname || displayName}
        size="chat"
        shape="circle"
        personId={id}
        className="mt-1 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="border border-border px-1.5 py-0.5 text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                {tCommon('memberRoleLabel')}
              </span>
              {joined?.isNew ? (
                <span className="bg-[#3cae4a] px-1.5 py-0.5 text-[10px] tracking-[0.12em] text-white uppercase">
                  {t('newMember')}
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-3 font-medium text-foreground">
              {displayName}
            </p>
            {nickname ? (
              <p className="truncate text-1 text-muted-foreground">
                @{nickname}
              </p>
            ) : null}
          </div>
          {onChat || onCall || onVideo ? (
            <MemberConnectActions
              chatLabel={tHome('chatPerson', { name: displayName })}
              callLabel={tHome('callPerson', { name: displayName })}
              videoLabel={tHome('videoPerson', { name: displayName })}
              onChat={onChat}
              onCall={onCall}
              onVideo={onVideo}
            />
          ) : null}
        </div>
        {joined || spaceIcons.length > 0 ? (
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="min-w-0 text-1 text-muted-foreground">
              {joined?.label}
            </p>
            <MemberSpaceIcons
              spaces={spaceIcons}
              size={20}
              max={3}
              className="shrink-0"
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
