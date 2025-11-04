'use client';

import { Person } from '@hypha-platform/core/client';
import { useMemo } from 'react';
import { InnerSpaceCard } from './inner-space-card';
import { UseMembers } from '../hooks';

type InnerSpaceCardWrapperProps = {
  spaceSlug: string;
  title?: string;
  description?: string;
  leadImageUrl?: string;
  useMembers: UseMembers;
  parentTitle?: string;
  parentPath?: string;
  createdAt?: Date;
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
  createdAt,
  className,
}: InnerSpaceCardWrapperProps) => {
  const { persons, isLoading } = useMembers({ spaceSlug });

  const mappedMembers = useMemo(
    () =>
      persons?.data?.map((member: Person) => ({
        name: member.name || '',
        surname: member.surname || '',
        avatar: member.avatarUrl || '/placeholder/default-profile.svg',
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
      createdAt={createdAt}
      className={className}
    />
  );
};
