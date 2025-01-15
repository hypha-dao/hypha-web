import { FC } from 'react';
import { MemberCard } from './member-card';
import { useMembers } from '../../hooks/use-members';
import { MemberCardProps } from './member-card';
import Link from 'next/link';

type MembersListProps = {
  page: number;
  activeFilter: string;
  membersProp?: MemberCardProps[];
  isLoadingProp?: boolean;
  minimize?: boolean;
  basePath?: string;
};

export const MembersList: FC<MembersListProps> = ({
  page,
  activeFilter,
  membersProp,
  isLoadingProp,
  minimize,
  basePath,
}) => {
  const { members, isLoading } = useMembers({
    page,
    ...(activeFilter !== 'all' && { filter: { status: activeFilter } }),
  });
  return (
    <div className="member-list w-full">
      {(membersProp ? membersProp : members).map((member, index) => (
        <Link
          href={`${basePath}/${member.slug}`}
          key={`${member.nickname} ${index}`}
          scroll={false}
        >
          <MemberCard
            minimize={minimize ?? false}
            key={index}
            {...member}
            isLoading={isLoading}
          />
        </Link>
      ))}

      {(isLoading || isLoadingProp) && (
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
