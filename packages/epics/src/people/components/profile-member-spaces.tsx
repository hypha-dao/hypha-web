'use client';

import { Skeleton, Image, Button } from '@hypha-platform/ui';
import { Person, Space, useMe } from '@hypha-platform/core/client';
import { ExitSpace, getDhoPathAgreements } from '@hypha-platform/epics';
import React from 'react';
import Link from 'next/link';
import { Locale } from '@hypha-platform/i18n';
import { useParams } from 'next/navigation';
import { Empty } from '@hypha-platform/epics';
import { ExitIcon, GlobeIcon, PlusIcon } from '@radix-ui/react-icons';
import { useAuthentication } from '@hypha-platform/authentication';

export type ProfileMemberSpacesProps = {
  person: Person;
  spaces?: Space[];
  isLoading?: boolean;
  profileView?: boolean;
};

export const ProfileMemberSpaces = ({
  person,
  spaces,
  isLoading,
  profileView = false,
}: ProfileMemberSpacesProps) => {
  const { lang } = useParams();

  const { isMe } = useMe();
  const isMyProfile = person.slug ? isMe(person.slug) : false;

  const iconSize = React.useMemo(() => (profileView ? 64 : 40), [profileView]);
  const { isAuthenticated } = useAuthentication();

  return (
    <div className="flex justify-between items-center mt-4 mb-4">
      {!spaces?.length ? (
        <Empty>
          <div className="flex flex-col gap-7">
            <p>
              No spaces created or joined yet. Explore our network and join some
              Space, or create your own
            </p>
            <div className="flex gap-4 items-center justify-center">
              <Link href={`/${lang}/network`}>
                <Button variant="outline" className="gap-2">
                  <GlobeIcon />
                  Explore Spaces
                </Button>
              </Link>
              <Link
                className={!isAuthenticated ? 'cursor-not-allowed' : ''}
                title={
                  !isAuthenticated ? 'Please sign in to use this feature.' : ''
                }
                href={isAuthenticated ? `/${lang}/my-spaces/create` : {}}
                scroll={false}
              >
                <Button disabled={!isAuthenticated} className="gap-2">
                  <PlusIcon />
                  Create Space
                </Button>
              </Link>
            </div>
          </div>
        </Empty>
      ) : (
        <>
          {isLoading ? (
            <Skeleton
              width="60px"
              height="26px"
              loading={isLoading}
              className="rounded-lg"
            />
          ) : !profileView ? (
            <div className="text-4 mr-4">Spaces</div>
          ) : null}
          {isLoading ? (
            <div className="flex flex-row gap-3 overflow-x-auto">
              <Skeleton
                width={`${iconSize}px`}
                height={`${iconSize}px`}
                loading={isLoading}
                className="rounded-full"
              />
              <Skeleton
                width={`${iconSize}px`}
                height={`${iconSize}px`}
                loading={isLoading}
                className="rounded-full"
              />
              <Skeleton
                width={`${iconSize}px`}
                height={`${iconSize}px`}
                loading={isLoading}
                className="rounded-full"
              />
            </div>
          ) : (
            <div className="flex flex-row gap-3 overflow-x-auto">
              {spaces?.map((space, index) => (
                <Link
                  key={space.id || index}
                  href={getDhoPathAgreements(lang as Locale, space.slug ?? '')}
                >
                  <div className="group relative" title={space.title}>
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
                        src={
                          space.logoUrl ?? '/placeholder/space-avatar-image.svg'
                        }
                        alt={space.title ?? ''}
                      />
                    </div>
                    {profileView && space.web3SpaceId && isMyProfile ? (
                      <div
                        className="absolute w-[20px] h-[20px] top-[5px] right-[5px] sm:invisible group-hover:visible"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                      >
                        <ExitSpace
                          web3SpaceId={space.web3SpaceId}
                          exitButton={
                            <Button
                              size="icon"
                              variant="outline"
                              colorVariant="neutral"
                              className="border-0 w-[20px] h-[20px]"
                              title="Exit Space"
                            >
                              <ExitIcon width={12} height={12} />
                            </Button>
                          }
                        />
                      </div>
                    ) : null}
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
        </>
      )}
    </div>
  );
};
