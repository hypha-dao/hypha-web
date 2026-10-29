'use client';

import { Skeleton, Image, Button } from '@hypha-platform/ui';
import { Person, Space, useMe } from '@hypha-platform/core/client';
import { ExitSpace, getDhoPathDefaultLanding } from '@hypha-platform/epics';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Locale } from '@hypha-platform/i18n';
import { useParams } from 'next/navigation';
import { Empty } from '@hypha-platform/epics';
import { ExitIcon, GlobeIcon, PlusIcon } from '@radix-ui/react-icons';
import { useAuthentication } from '@hypha-platform/authentication';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import { getOnboardingPath } from '../../common/get-path-function';
import {
  readRecentSpaceSlugs,
  subscribeRecentSpaceSlugs,
} from '../../common/recent-space-history';
import { groupSpacesByEcosystemRecency } from './order-spaces-by-ecosystem';

export type ProfileMemberSpacesProps = {
  person: Person;
  spaces?: Space[];
  isLoading?: boolean;
  profileView?: boolean;
};

/** Compact marks on the profile story; larger than the home rail so labels stay readable. */
const PROFILE_ICON = 40;
const LIST_ICON = 40;

export const ProfileMemberSpaces = ({
  person,
  spaces,
  isLoading,
  profileView = false,
  className,
}: ProfileMemberSpacesProps & { className?: string }) => {
  const tCommon = useTranslations('Common');
  const tSpaces = useTranslations('Spaces');
  const { lang } = useParams();

  const { isMe } = useMe();
  const isMyProfile = person.slug ? isMe(person.slug) : false;

  const iconSize = profileView ? PROFILE_ICON : LIST_ICON;
  const { isAuthenticated } = useAuthentication();
  const [recentSlugs, setRecentSlugs] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : readRecentSpaceSlugs(),
  );

  useEffect(() => subscribeRecentSpaceSlugs(setRecentSlugs), []);

  const ecosystemGroups = useMemo(
    () => groupSpacesByEcosystemRecency(spaces ?? [], recentSlugs),
    [recentSlugs, spaces],
  );

  return (
    <div
      className={cn(
        'mb-4 mt-4 flex items-center justify-between',
        profileView && 'mb-0 mt-0',
        className,
      )}
    >
      {!spaces?.length ? (
        <Empty>
          <div className="flex flex-col gap-7">
            <p>{tCommon('noSpacesYet')}</p>
            <div className="flex gap-4 items-center justify-center">
              <Link href={`/${lang}/network`}>
                <Button variant="outline" className="gap-2">
                  <GlobeIcon />
                  {tCommon('exploreSpaces')}
                </Button>
              </Link>
              <Link
                className={!isAuthenticated ? 'cursor-not-allowed' : ''}
                title={!isAuthenticated ? tCommon('signIn') : ''}
                href={isAuthenticated ? getOnboardingPath(lang as Locale) : {}}
                scroll={false}
              >
                <Button disabled={!isAuthenticated} className="gap-2">
                  <PlusIcon />
                  {tSpaces('createSpace')}
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
            <div className="text-4 mr-4">{tCommon('Spaces')}</div>
          ) : null}
          {isLoading ? (
            <div className="flex flex-row gap-2 overflow-x-auto">
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
            <div
              className="flex min-w-0 flex-row items-start gap-2 overflow-x-auto"
              aria-label={tCommon('Spaces')}
            >
              {ecosystemGroups.map((group, groupIndex) => (
                <React.Fragment key={group.rootId}>
                  {groupIndex > 0 ? (
                    <span
                      aria-hidden
                      className="mx-0.5 mt-2 h-6 w-px shrink-0 self-start bg-border"
                    />
                  ) : null}
                  <div className="flex shrink-0 flex-row items-start gap-2">
                    {group.spaces.map((space) => (
                      <Link
                        key={space.id}
                        href={getDhoPathDefaultLanding(
                          lang as Locale,
                          space.slug ?? '',
                        )}
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
                                space.logoUrl ??
                                '/placeholder/space-avatar-image.svg'
                              }
                              alt={space.title ?? ''}
                            />
                          </div>
                          {profileView && space.web3SpaceId && isMyProfile ? (
                            <div
                              className="absolute top-0.5 right-0.5 invisible h-4 w-4 [@media(hover:none)]:visible group-hover:visible"
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
                                    className="h-4 w-4 border-0"
                                    title={tSpaces('exitSpace')}
                                  >
                                    <ExitIcon width={10} height={10} />
                                  </Button>
                                }
                              />
                            </div>
                          ) : null}
                          {profileView ? (
                            <div
                              className="mt-1.5 overflow-hidden text-ellipsis text-nowrap text-1"
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
                </React.Fragment>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
