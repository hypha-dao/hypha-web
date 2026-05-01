import { FC } from 'react';
import { MemberCard } from './member-card';
import Link from 'next/link';
import { type UseMembers, SpaceMemberCard } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';
import { cn } from '@hypha-platform/ui-utils';

type MembersListProps = {
  page: number;
  basePath: string;
  useMembers: UseMembers;
  spaceId?: number;
  spaceSlug?: string;
  searchTerm?: string;
  refreshInterval?: number;
};

const GRID_CLASS =
  'grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3';

function MembersGridSkeleton() {
  return (
    <div className={cn(GRID_CLASS, 'min-h-36')} aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <MemberCard key={`member-skel-${i}`} isLoading />
      ))}
    </div>
  );
}

export const MembersList: FC<MembersListProps> = ({
  page,
  basePath,
  useMembers,
  spaceId,
  spaceSlug,
  searchTerm,
  refreshInterval,
}) => {
  const { lang } = useParams<{ lang: Locale }>();
  const { persons, spaces, isLoading } = useMembers({
    page,
    spaceSlug,
    searchTerm,
    refreshInterval,
  });

  const hasRows =
    (persons?.data && persons.data.length > 0) ||
    (spaces.data?.length ?? 0) > 0;
  const showOnlySkeleton = isLoading && !hasRows;

  return (
    <div className="w-full min-w-0" data-testid="members-list-grid">
      {showOnlySkeleton ? <MembersGridSkeleton /> : null}

      {!showOnlySkeleton && (
        <div className={GRID_CLASS}>
          {persons?.data?.map((member) => {
            const href = `${basePath}/${member.slug}`;
            return (
              <div
                key={member.slug}
                className="min-w-0"
                data-testid="members-list-person"
              >
                <MemberCard
                  spaceId={spaceId}
                  profileHref={href}
                  {...member}
                  isLoading={false}
                />
              </div>
            );
          })}
          {(spaces?.data ?? []).map((space) => (
            <div
              key={space.slug}
              className="min-w-0"
              data-testid="members-list-nested-space"
            >
              <Link
                href={`/${lang}/dho/${space.slug}/agreements`}
                className="block h-full"
                scroll={false}
                data-testid="members-list-space-link"
              >
                <SpaceMemberCard
                  hostSpaceId={spaceId}
                  space={space}
                  isLoading={false}
                />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
