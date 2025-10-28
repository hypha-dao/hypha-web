import { FC } from 'react';
import { MemberCard } from './member-card';
import Link from 'next/link';
import { type UseMembers, SpaceMemberCard } from '@hypha-platform/epics';
import { useParams } from 'next/navigation';
import { Locale } from '@hypha-platform/i18n';

type MembersListProps = {
  page: number;
  minimize?: boolean;
  basePath: string;
  useMembers: UseMembers;
  spaceId?: number;
  spaceSlug?: string;
  searchTerm?: string;
  refreshInterval?: number;
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
}) => {
  const { lang } = useParams<{ lang: Locale }>();
  const { persons, spaces, isLoading } = useMembers({
    page,
    spaceSlug,
    searchTerm,
    refreshInterval,
  });
  return (
    <div className="member-list w-full">
      {persons?.data?.map((member) => (
        <Link
          href={`${basePath}/${member.slug}`}
          key={member.slug}
          scroll={false}
        >
          <MemberCard
            spaceId={spaceId}
            minimize={minimize}
            {...member}
            isLoading={isLoading}
          />
        </Link>
      ))}
      {spaces.data.map((space) => (
        <Link
          href={`/${lang}/dho/${space.slug}/agreements`}
          key={space.slug}
          scroll={false}
        >
          <SpaceMemberCard space={space} isLoading={isLoading} />
        </Link>
      ))}

      {isLoading && (
        <div>
          <MemberCard isLoading={isLoading} />
          <MemberCard isLoading={isLoading} />
          <MemberCard isLoading={isLoading} />
          <MemberCard isLoading={isLoading} />
        </div>
      )}
    </div>
  );
};
