'use client';

import { InnerSpaceCard } from '@hypha-platform/epics';
import { Person } from '@hypha-platform/core/client';
import { useMemo } from 'react';

import { UseMembers } from '@hypha-platform/epics';

type InnerSpaceCardWrapperProps = {
  spaceSlug: string;
  title?: string;
  description?: string;
  leadImageUrl?: string;
  useMembers: UseMembers;
};

export const InnerSpaceCardWrapper = ({
  spaceSlug,
  title,
  description,
  leadImageUrl,
  useMembers,
}: InnerSpaceCardWrapperProps) => {
  const { members = [], isLoading } = useMembers({ spaceSlug });

  const mappedMembers = useMemo(
    () =>
      members.map((member: Person) => ({
        name: member.name || '',
        surname: member.surname || '',
        avatar: member.avatarUrl || '/placeholder/avatar.png',
      })),
    [members],
  );

  return (
    <InnerSpaceCard
      title={title}
      description={description}
      leadImageUrl={leadImageUrl}
      members={mappedMembers}
      isLoading={isLoading}
    />
  );
};
