import { FC, useMemo } from 'react';
import { MemberCard } from './member-card';
import Link from 'next/link';
import { type UseMembers, SpaceMemberCard } from '@hypha-platform/epics';
import { getDhoSpaceContextPath } from '@hypha-platform/epics';
import { useParams, usePathname } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import { useMe } from '@hypha-platform/core/client';
import { useMemberDirectoryConnect } from './use-member-directory-connect';
import { MEMBER_DIRECTORY_PAGE_SIZE } from '../hooks/use-members-section';

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
    pageSize: MEMBER_DIRECTORY_PAGE_SIZE,
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
    <>
      {notice ? (
        <p className="col-span-full text-1 text-error-11" role="alert">
          {notice}
        </p>
      ) : null}
      {entityFilter !== 'space' &&
        people.map((member) => {
          const connectable = member.id !== me?.id;
          return (
            <div
              key={member.slug}
              role={connectable ? 'button' : undefined}
              tabIndex={connectable ? 0 : undefined}
              className={
                connectable ? 'block h-full cursor-pointer' : 'block h-full'
              }
              onClick={() => {
                if (!connectable) return;
                void openChat(member);
              }}
              onKeyDown={(event) => {
                if (!connectable || event.target !== event.currentTarget) {
                  return;
                }
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                void openChat(member);
              }}
            >
              <MemberCard
                spaceId={spaceId}
                minimize={minimize}
                {...member}
                isLoading={isLoading}
                onChat={connectable ? () => void openChat(member) : undefined}
                onCall={connectable ? () => void openCall(member) : undefined}
                onVideo={connectable ? () => void openVideo(member) : undefined}
              />
            </div>
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
    </>
  );
};
