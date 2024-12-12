import { FC } from 'react';
import { MemberCard } from './member-card';
import { useMembers } from '../../hooks/use-members';

type MembersListProps = {
  page: number;
  activeFilter: string;
};

export const MembersList: FC<MembersListProps> = ({ page, activeFilter }) => {
  const { members, isLoading } = useMembers({
    page,
    ...(activeFilter !== 'all' && { filter: { status: activeFilter } }),
  });
  return (
    <div className="member-list w-full">
      {members.map((member, index) => (
        <MemberCard key={index} {...member} isLoading={isLoading} />
      ))}
      {isLoading ? (
        <div>
          <MemberCard isLoading={isLoading} />
          <MemberCard isLoading={isLoading} />
          <MemberCard isLoading={isLoading} />
          <MemberCard isLoading={isLoading} />
        </div>
      ) : null}
    </div>
  );
};
