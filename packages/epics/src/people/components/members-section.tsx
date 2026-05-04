'use client';

import { FC, useState } from 'react';
import { Text } from '@radix-ui/themes';
import { SectionLoadMore } from '@hypha-platform/ui/server';

import { MembersList } from './members-list';
import { useMembersSection } from '../hooks/use-members-section';
import { ExitSpace, UseMembers, useSpaceMember } from '../../spaces';
import { Empty } from '../../common';
import { Button, Input } from '@hypha-platform/ui';
import {
  useSpaceBySlug,
  useMe,
  useIsDelegate,
} from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { SearchIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui';

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
  const [entityFilter, setEntityFilter] = useState<'member' | 'space'>(
    'member',
  );
  const {
    pages,
    isLoading,
    loadMore,
    pagination,
    personCount,
    spaceCount,
    onUpdateSearch,
    searchTerm,
  } = useMembersSection({
    useMembers,
    spaceSlug,
    refreshInterval,
  });
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
  const canDelegateLink = !isDisabled && Boolean(person?.slug);
  const tooltipMessage = !isAuthenticated
    ? tCommon('signIn')
    : !isMember
    ? tCommon('joinSpaceToUse')
    : '';

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <div className="w-full">
        <Tabs
          value={entityFilter}
          onValueChange={(value) =>
            setEntityFilter(value as 'member' | 'space')
          }
        >
          <TabsList triggerVariant="switch" className="w-fit">
            <TabsTrigger value="member" variant="switch">
              <span className="inline-flex items-center gap-1">
                <span>{tMembers('member')}</span>
                <span className="text-xs text-muted-foreground">
                  ({Intl.NumberFormat().format(personCount)})
                </span>
              </span>
            </TabsTrigger>
            <TabsTrigger value="space" variant="switch">
              <span className="inline-flex items-center gap-1">
                <span>{tMembers('space')}</span>
                <span className="text-xs text-muted-foreground">
                  ({Intl.NumberFormat().format(spaceCount)})
                </span>
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
        <Input
          type="search"
          placeholder={tMembers('searchMembers')}
          onChange={(event) => onUpdateSearch(event.target.value)}
          leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
          className="w-full"
        />
        <div className="flex w-full items-center justify-end gap-2 lg:w-auto">
          <ExitSpace web3SpaceId={space?.web3SpaceId as number} />
          {!isDelegate ? (
            canDelegateLink ? (
              <Link
                title={tooltipMessage || ''}
                className={isDisabled ? 'cursor-not-allowed' : ''}
                href={`${basePath}/${person!.slug}`}
                scroll={false}
              >
                <Button disabled={isDisabled || isMemberLoading}>
                  {tMembers('delegateVoting')}
                </Button>
              </Link>
            ) : (
              <div title={tooltipMessage || ''} className="cursor-not-allowed">
                <Button disabled={isDisabled || isMemberLoading}>
                  {tMembers('delegateVoting')}
                </Button>
              </div>
            )
          ) : null}
        </div>
      </div>
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
            entityFilter={entityFilter}
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
