'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { MemberConnectActions } from './member-card';
import { PersonAvatar } from './person-avatar';
import { usePersonMemberSpaces } from './member-space-icons';

const NEW_MEMBER_MS = 30 * 24 * 60 * 60 * 1000;

function spaceCode(title: string) {
  const words = title
    .split(/[^A-Za-z0-9]+/)
    .map((word) => word.trim())
    .filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]!.charAt(0)}${words[1]!.charAt(0)}`.toUpperCase();
  }
  return (words[0] ?? title).slice(0, 2).toUpperCase();
}

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
  const codes = spaces
    .map((item) => spaceCode(item.title))
    .filter(Boolean)
    .slice(0, 3);

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
        {joined || codes.length > 0 ? (
          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="min-w-0 text-1 text-muted-foreground">
              {joined?.label}
            </p>
            {codes.length > 0 ? (
              <p className="shrink-0 text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                {codes.join(' ')}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
