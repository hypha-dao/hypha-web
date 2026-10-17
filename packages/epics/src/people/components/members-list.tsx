import { FC, useMemo } from 'react';
import { MemberCard } from './member-card';
import Link from 'next/link';
import { type UseMembers, SpaceMemberCard } from '@hypha-platform/epics';
import { getDhoSpaceContextPath } from '@hypha-platform/epics';
import { useParams, usePathname } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import { useMe } from '@hypha-platform/core/client';
import { useMemberDirectoryConnect } from './use-member-directory-connect';

type MembersListProps = {
  page: number;
  minimize?: boolean;
  basePath: string;
  useMembers: UseMembers;
  spaceId?: number;
  spaceSlug?: string;
  searchTerm?: string;
  refreshInterval?: number;
  energySharingOnly?: boolean;
  entityFilter?: 'member' | 'space';
};

export const MembersList: FC<MembersListProps> = ({
  page,
  minimize,
  basePath,
  useMembers,
  spaceId,
  spaceSlug,
  searchTerm,
  refreshInterval,
  energySharingOnly,
  entityFilter = 'member',
}) => {
  const { lang } = useParams<{ lang: Locale }>();
  const pathname = usePathname();
  const { person: me } = useMe();
  const { persons, spaces, isLoading } = useMembers({
    page,
    spaceSlug,
    searchTerm,
    refreshInterval,
    energySharingOnly,
  });
  const people = useMemo(
    () => (entityFilter === 'space' ? [] : persons?.data ?? []),
    [entityFilter, persons?.data],
  );
  const { openChat, openCall, openVideo, notice } =
    useMemberDirectoryConnect(people);
  return (
    <div className="@container/members w-full">
      {notice ? (
        <p className="mb-3 text-1 text-error-11" role="alert">
          {notice}
        </p>
      ) : null}
      <div className="member-list grid w-full grid-cols-1 gap-3 @min-[40rem]/members:grid-cols-2 @min-[62rem]/members:grid-cols-3">
        {entityFilter !== 'space' &&
          people.map((member) => {
            const connectable = member.id !== me?.id;
            return (
              <Link
                href={`${basePath}/${member.slug}`}
                key={member.slug}
                scroll={false}
                className="block h-full"
              >
                <MemberCard
                  spaceId={spaceId}
                  minimize={minimize}
                  {...member}
                  isLoading={isLoading}
                  onChat={connectable ? () => void openChat(member) : undefined}
                  onCall={connectable ? () => void openCall(member) : undefined}
                  onVideo={
                    connectable ? () => void openVideo(member) : undefined
                  }
                />
              </Link>
            );
          })}
        {entityFilter !== 'member' &&
          spaces.data.map((space) => {
            const href =
              getDhoSpaceContextPath({
                pathname,
                lang,
                spaceSlug: space.slug,
              }) ?? `/${lang}/dho/${space.slug}/agreements`;
            return (
              <Link
                href={href}
                key={space.slug}
                scroll={false}
                className="block h-full"
              >
                <SpaceMemberCard
                  hostSpaceId={spaceId}
                  space={space}
                  isLoading={isLoading}
                />
              </Link>
            );
          })}

        {isLoading && (
          <>
            <MemberCard isLoading={isLoading} />
            <MemberCard isLoading={isLoading} />
            <MemberCard isLoading={isLoading} />
            <MemberCard isLoading={isLoading} />
          </>
        )}
      </div>
    </div>
  );
};
