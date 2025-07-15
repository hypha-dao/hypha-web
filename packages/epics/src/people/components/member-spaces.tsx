'use client';

import { Skeleton, Image } from '@hypha-platform/ui';
import { Space } from '@hypha-platform/core/client';
import { Person } from '@core/people';
import { filterSpaces, getDhoPathGovernance, useMemberWeb3SpaceIds } from '@hypha-platform/epics';
import React from 'react';
import { cn } from '@hypha-platform/lib/utils';
import Link from 'next/link';
import { Locale } from '@hypha-platform/i18n';
import { useParams } from 'next/navigation';

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
  const { lang } = useParams();
  const { web3SpaceIds, isLoading: isLoadingSpaces } = useMemberWeb3SpaceIds({ person });

  const filteredSpaces = React.useMemo(
    () => filterSpaces(spaces ?? [], person, web3SpaceIds),
    [spaces, person, web3SpaceIds],
  );

  const iconSize = React.useMemo(
    () => profileView ? 64 : 40,
    [profileView],
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
            width={`${iconSize}px`}
            height={`${iconSize}px`}
            loading={isLoading || isLoadingSpaces}
            className="rounded-full"
          />
          <Skeleton
            width={`${iconSize}px`}
            height={`${iconSize}px`}
            loading={isLoading || isLoadingSpaces}
            className="rounded-full"
          />
          <Skeleton
            width={`${iconSize}px`}
            height={`${iconSize}px`}
            loading={isLoading || isLoadingSpaces}
            className="rounded-full"
          />
        </div>
      ) : (
        <div className="flex flex-row gap-3 overflow-x-auto">
          {filteredSpaces?.map((space, index) => (
            <Link key={index} href={getDhoPathGovernance(lang as Locale, space.slug ?? '')}>
              <div title={space.title}>
                <div className={cn(
                  'relative flex',
                  `h-[${iconSize}px]`,
                  `w-[${iconSize}px]`,
                  'shrink-0 overflow-hidden rounded-full'
                )}>
                  <Image
                    className="aspect-square h-full w-full object-cover"
                    width={iconSize}
                    height={iconSize}
                    src={space.logoUrl ?? '/placeholder/space-avatar-image.png'}
                    alt={space.title ?? ''}
                  />
                </div>
                {profileView ? (
                  <div className="text-1 text-ellipsis overflow-hidden text-nowrap max-w-[64px] mt-2">
                    {space.title}
                  </div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
