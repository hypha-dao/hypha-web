'use client';

import { FC, useEffect, useMemo, useState } from 'react';
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
import {
  readMobilizedAiAgents,
  subscribeMobilizedAiAgents,
} from '../../common/ai-agent-competencies';

function tagGroupAccentClass(tagGroup: string): string {
  switch (tagGroup) {
    case 'purpose':
      return 'bg-accent-3 text-accent-12 border-accent-6';
    case 'governance':
      return 'bg-info-3 text-info-12 border-info-6';
    case 'operations':
      return 'bg-success-3 text-success-12 border-success-6';
    case 'community':
      return 'bg-neutral-3 text-neutral-12 border-neutral-6';
    case 'finance':
      return 'bg-warning-3 text-warning-12 border-warning-6';
    case 'product':
      return 'bg-accent-2 text-accent-11 border-accent-6';
    case 'risk':
      return 'bg-error-3 text-error-12 border-error-6';
    case 'ecosystem':
      return 'bg-info-2 text-info-11 border-info-6';
    case 'learning':
      return 'bg-success-2 text-success-11 border-success-6';
    case 'reputation':
      return 'bg-warning-2 text-warning-11 border-warning-6';
    default:
      return 'bg-muted text-foreground border-border';
  }
}

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
  const tCoherence = useTranslations('CoherenceTab');
  const [entityFilter, setEntityFilter] = useState<'member' | 'space' | 'ai'>(
    'member',
  );
  const [agentRefreshEpoch, setAgentRefreshEpoch] = useState(0);
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

  useEffect(() => {
    const unsubscribe = subscribeMobilizedAiAgents(spaceSlug, () =>
      setAgentRefreshEpoch((v) => v + 1),
    );
    return unsubscribe;
  }, [spaceSlug]);

  const aiAgents = useMemo(
    () => readMobilizedAiAgents(spaceSlug),
    [spaceSlug, agentRefreshEpoch],
  );

  const aiAgentCount = aiAgents.length;

  return (
    <div className="flex flex-col w-full justify-center items-center gap-4">
      <div className="w-full">
        <Tabs
          value={entityFilter}
          onValueChange={(value) =>
            setEntityFilter(value as 'member' | 'space' | 'ai')
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
            <TabsTrigger value="ai" variant="switch">
              <span className="inline-flex items-center gap-1">
                <span>{tMembers('aiAgents')}</span>
                <span className="text-xs text-muted-foreground">
                  ({Intl.NumberFormat().format(aiAgentCount)})
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
          aria-label={tMembers('searchMembers')}
          onChange={(event) => onUpdateSearch(event.target.value)}
          leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
          className="w-full"
          disabled={entityFilter === 'ai'}
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
      {entityFilter === 'ai' ? (
        aiAgents.length === 0 ? (
          <Empty>
            <p>{tMembers('aiAgentsEmptyState')}</p>
          </Empty>
        ) : (
          <div className="member-list grid w-full grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {aiAgents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-xl border border-border bg-background-2 p-4"
              >
                <div className="mb-3 flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${tagGroupAccentClass(
                      agent.tagGroup,
                    )}`}
                    aria-hidden="true"
                  >
                    {agent.avatarLabel}
                  </div>
                  <div className="min-w-0">
                    <div className="mb-1 text-sm font-semibold text-foreground">
                      {tCoherence(agent.role)}
                    </div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {agent.tagGroup}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {tCoherence(agent.focus)}
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {agent.roleDefinition.map((line, index) => (
                    <li
                      key={`${agent.id}-def-${index}`}
                      className="leading-relaxed"
                    >
                      {index + 1}. {tCoherence(line)}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 text-xs text-muted-foreground">
                  {tMembers('aiAgentsMobilizedCount', {
                    count: agent.mobilizedCount,
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      ) : pagination?.total === 0 ? (
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
      {entityFilter === 'ai' || pagination?.total === 0 ? null : (
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
