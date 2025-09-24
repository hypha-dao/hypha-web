'use client';

import { getDhoPathAgreements, InnerSpaceCard } from '@hypha-platform/epics';
import { Person } from '@hypha-platform/core/client';
import { useMemo } from 'react';

import { UseMembers } from '@hypha-platform/epics';

type InnerSpaceCardWrapperProps = {
  spaceSlug: string;
  title?: string;
  description?: string;
  leadImageUrl?: string;
  useMembers: UseMembers;
  parentTitle?: string;
  parentPath?: string;
  className?: string;
};

export const InnerSpaceCardWrapper = ({
  spaceSlug,
  title,
  description,
  leadImageUrl,
  useMembers,
  parentTitle,
  parentPath,
  className,
}: InnerSpaceCardWrapperProps) => {
  const { persons, isLoading } = useMembers({ spaceSlug });

  const mappedMembers = useMemo(
    () =>
      persons?.data?.map((member: Person) => ({
        name: member.name || '',
        surname: member.surname || '',
        avatar: member.avatarUrl || '/placeholder/avatar.png',
      })),
    [persons.data],
  );

  return (
    <InnerSpaceCard
      title={title}
      description={description}
      leadImageUrl={leadImageUrl}
      members={mappedMembers}
      isLoading={isLoading}
      parentTitle={parentTitle}
      parentPath={parentPath}
      className={className}
    />
  );
};
