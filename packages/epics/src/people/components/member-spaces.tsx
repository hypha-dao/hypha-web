'use client';

import { Skeleton, Image } from '@hypha-platform/ui';
import { Space } from '@hypha-platform/core/client';
import { Person } from '@core/people';
import { filterSpaces, useMemberWeb3SpaceIds } from '@hypha-platform/epics';
import React from 'react';
import { cn } from '@hypha-platform/lib/utils';

export type MemberSpacesProps = {
  spaces?: Space[];
  isLoading?: boolean;
  profileView?: boolean;
  person?: Person;
};

export const MemberSpaces = ({
  spaces,
  isLoading,
  profileView = false,
  person,
}: MemberSpacesProps) => {
  const { web3SpaceIds, isLoading: isLoadingSpaces } = useMemberWeb3SpaceIds({ person });

  const filteredSpaces = React.useMemo(
    () => filterSpaces(spaces ?? [], person, web3SpaceIds),
    [spaces, person, web3SpaceIds],
  );
  
  return (
    <div className="flex justify-between items-center mt-4 mb-4">
      {isLoading || isLoadingSpaces ? (
        <Skeleton
          width="60px"
          height="26px"
          loading={isLoading}
          className="rounded-lg"
        />
      ) : !profileView ? (
        <div className="text-4 mr-4">Spaces</div>
      ) : null}
      {isLoading || isLoadingSpaces ? (
        <div className="flex flex-row gap-3 overflow-x-auto">
          <Skeleton
            width="40px"
            height="40px"
            loading={isLoading || isLoadingSpaces}
            className="rounded-full"
          />
          <Skeleton
            width="40px"
            height="40px"
            loading={isLoading || isLoadingSpaces}
            className="rounded-full"
          />
          <Skeleton
            width="40px"
            height="40px"
            loading={isLoading || isLoadingSpaces}
            className="rounded-full"
          />
        </div>
      ) : (
        <div className="flex flex-row gap-3 overflow-x-auto">
          {filteredSpaces?.map((space, index) => (
            <div key={index}>
              <div className={cn(
                'relative flex',
                `h-[${profileView ? 64 : 40}px]`,
                `w-[${profileView ? 64 : 40}px]`,
                'shrink-0 overflow-hidden rounded-full'
              )}>
                <Image
                  className="aspect-square h-full w-full object-cover"
                  width={profileView ? 64 : 40}
                  height={profileView ? 64 : 40}
                  src={space.logoUrl ?? ''}
                  alt={space.title ?? ''}
                />
              </div>
              {profileView ? (
                <div className="text-1 text-ellipsis overflow-hidden text-nowrap max-w-[64px] mt-2">
                  {space.title}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
