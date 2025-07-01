'use client';

import { useMemo } from 'react';
import { SpaceCard } from '@hypha-platform/epics';
import { UseMembers } from '@hypha-platform/epics';

type SpaceCardWrapperProps = {
  spaceSlug: string;
  title?: string;
  description?: string;
  icon?: string;
  leadImage?: string;
  agreements?: number;
  useMembers: UseMembers;
};

export const SpaceCardWrapper = ({
  spaceSlug,
  title,
  description,
  icon,
  leadImage,
  agreements,
  useMembers,
}: SpaceCardWrapperProps) => {
  const { members = [], isLoading } = useMembers({ spaceSlug });

  const memberCount = useMemo(() => members.length, [members]);

  return (
    <SpaceCard
      title={title || ''}
      description={description || ''}
      icon={icon || '/placeholder/space-avatar-image.png'}
      leadImage={leadImage || '/placeholder/space-lead-image.png'}
      members={memberCount}
      agreements={agreements}
      isLoading={isLoading}
    />
  );
};
