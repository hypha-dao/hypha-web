'use client';

import { FC } from 'react';
import { Text } from '@radix-ui/themes';
import { SectionFilter, SectionLoadMore } from '@hypha-platform/ui/server';

import { MembersList } from './members-list';
import { useMembersSection } from '../hooks/use-members-section';
import { ExitSpace, UseMembers, useSpaceMember } from '../../spaces';
import { Empty } from '../../common';
import { Button } from '@hypha-platform/ui';
import {
  useSpaceBySlug,
  useMe,
  useIsDelegate,
} from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

type MemberSectionProps = {
  basePath: string;
  useMembers: UseMembers;
  spaceSlug?: string;
  refreshInterval?: number;
};

export const MembersSection: FC<MemberSectionProps> = ({
  basePath,
  useMembers,
  spaceSlug,
  refreshInterval,
}) => {
  const tCommon = useTranslations('Common');
  const tMembers = useTranslations('MembersTab');
  const { pages, isLoading, loadMore, pagination, onUpdateSearch, searchTerm } =
    useMembersSection({
      useMembers,
      spaceSlug,
      refreshInterval,
    });
  console.debug('MembersSection', { searchTerm });
  const { space } = useSpaceBySlug(spaceSlug as string);
  const { isMember, isMemberLoading } = useSpaceMember({
    spaceId: space?.web3SpaceId as number,
  });
  const { person } = useMe();
  const { isAuthenticated } = useAuthentication();
  const { isDelegate } = useIsDelegate({
    spaceId: space?.web3SpaceId as number,
  });
  const isDisabled = !isAuthenticated || !isMember;
  const tooltipMessage = !isAuthenticated
    ? tCommon('signIn')
    : !isMember
    ? tCommon('joinSpaceToUse')
    : '';

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <span className="w-full flex gap-4">
        <SectionFilter
          count={pagination?.total || 0}
          label={tCommon('Members')}
          hasSearch
          searchPlaceholder={tMembers('searchMembers')}
          onChangeSearch={onUpdateSearch}
        >
          <ExitSpace web3SpaceId={space?.web3SpaceId as number} />
        </SectionFilter>
        {!isDelegate && (
          <Link
            title={tooltipMessage || ''}
            className={isDisabled ? 'cursor-not-allowed' : ''}
            href={`${basePath}/${person?.slug}`}
            scroll={false}
          >
            <Button disabled={isDisabled || isMemberLoading}>
              {tMembers('delegateVoting')}
            </Button>
          </Link>
        )}
      </span>
      {pagination?.total === 0 ? (
        <Empty>
          <p>{tMembers('listIsEmpty')}</p>
        </Empty>
      ) : (
        Array.from({ length: pages }).map((_, index) => (
          <MembersList
            basePath={basePath}
            page={index + 1}
            key={index}
            useMembers={useMembers}
            spaceId={space?.id}
            spaceSlug={spaceSlug}
            searchTerm={searchTerm}
            refreshInterval={refreshInterval}
          />
        ))
      )}
      {pagination?.total === 0 ? null : (
        <SectionLoadMore
          onClick={loadMore}
          disabled={
            isLoading ||
            (pagination &&
              (pagination.totalPages === pages || !pagination.hasNextPage))
          }
          isLoading={isLoading}
        >
          <Text>
            {isLoading
              ? tMembers('loading')
              : pagination &&
                (pagination.totalPages === pages || !pagination.hasNextPage)
              ? tMembers('noMoreMembers')
              : tMembers('loadMoreMembers')}
          </Text>
        </SectionLoadMore>
      )}
    </div>
  );
};
