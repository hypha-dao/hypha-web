'use client';

import { Skeleton, Image } from '@hypha-platform/ui';
import { Address, Space } from '@hypha-platform/core/client';
import {
  filterSpaces,
  getDhoPathGovernance,
  useMemberWeb3SpaceIds,
} from '@hypha-platform/epics';
import React from 'react';
import Link from 'next/link';
import { Locale } from '@hypha-platform/i18n';
import { useParams } from 'next/navigation';

export type MemberSpacesProps = {
  spaces?: Space[];
  isLoading?: boolean;
  profileView?: boolean;
  personAddress?: Address;
  personSlug?: string;
};

export const MemberSpaces = ({
  spaces,
  isLoading,
  profileView = false,
  personAddress,
  personSlug,
}: MemberSpacesProps) => {
  const { lang } = useParams();
  const { web3SpaceIds, isLoading: isLoadingSpaces } = useMemberWeb3SpaceIds({
    personAddress,
  });

  const filteredSpaces = React.useMemo(
    () => filterSpaces(spaces ?? [], personSlug, web3SpaceIds),
    [spaces, personSlug, web3SpaceIds],
  );

  const iconSize = React.useMemo(() => (profileView ? 64 : 40), [profileView]);

  const isLoadingState = React.useMemo(
    () => isLoading || isLoadingSpaces,
    [isLoading, isLoadingSpaces],
  );

  return (
    <div className="flex justify-between items-center mt-4 mb-4">
      {isLoadingState ? (
        <Skeleton
          width="60px"
          height="26px"
          loading={isLoading}
          className="rounded-lg"
        />
      ) : !profileView ? (
        <div className="text-4 mr-4">Spaces</div>
      ) : null}
      {isLoadingState ? (
        <div className="flex flex-row gap-3 overflow-x-auto">
          <Skeleton
            width={`${iconSize}px`}
            height={`${iconSize}px`}
            loading={isLoadingState}
            className="rounded-full"
          />
          <Skeleton
            width={`${iconSize}px`}
            height={`${iconSize}px`}
            loading={isLoadingState}
            className="rounded-full"
          />
          <Skeleton
            width={`${iconSize}px`}
            height={`${iconSize}px`}
            loading={isLoadingState}
            className="rounded-full"
          />
        </div>
      ) : (
        <div className="flex flex-row gap-3 overflow-x-auto">
          {filteredSpaces?.map((space, index) => (
            <Link
              key={index}
              href={getDhoPathGovernance(lang as Locale, space.slug ?? '')}
            >
              <div title={space.title}>
                <div
                  className="relative flex shrink-0 overflow-hidden rounded-full"
                  style={{
                    height: `${iconSize}px`,
                    width: `${iconSize}px`,
                  }}
                >
                  <Image
                    className="aspect-square h-full w-full object-cover"
                    width={iconSize}
                    height={iconSize}
                    src={space.logoUrl ?? '/placeholder/space-avatar-image.png'}
                    alt={space.title ?? ''}
                  />
                </div>
                {profileView ? (
                  <div
                    className="text-1 text-ellipsis overflow-hidden text-nowrap mt-2"
                    style={{
                      maxWidth: `${iconSize}px`,
                    }}
                  >
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
