'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useFindCoherences, useSpaceBySlug } from '@hypha-platform/core/client';
import {
  PersonAvatar,
  SpaceAttention,
  SpaceEnergySection,
  getAgentAvatarInitials,
  tagGroupAccentClass,
  useMobilizedAiAgents,
  useSpaceDocumentsWithStatuses,
  useSpaceEnergy,
} from '@hypha-platform/epics';
import type { Locale } from '@hypha-platform/i18n';
import { EcosystemDiagram } from '@web/components/ecosystem-diagram';
import { useMembers } from '@web/hooks/use-members';

import { OverviewMonth } from './overview-month';
import { SignalHeatMaps } from './signal-heat-map';
import { SpaceActivityList } from './space-activity';

function personLabel(person: {
  name?: string | null;
  surname?: string | null;
  nickname?: string | null;
}) {
  const full = [person.name, person.surname].filter(Boolean).join(' ').trim();
  return full || person.nickname?.trim() || '';
}

function Panel({
  title,
  href,
  openLabel,
  children,
  className,
}: {
  title: string;
  href: string;
  openLabel: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex min-w-0 flex-col border border-border bg-background-2 ${
        className ?? ''
      }`}
    >
      <div className="flex items-baseline justify-between gap-4 px-5 pt-5">
        <h2
          className="text-3 text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {title}
        </h2>
        <Link
          href={href}
          className="shrink-0 text-1 text-neutral-11 underline-offset-4 hover:text-foreground hover:underline"
        >
          {openLabel}
        </Link>
      </div>
      <div className="mt-4 min-w-0">{children}</div>
    </section>
  );
}

function MembershipPreview({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-1 text-neutral-11">{title}</p>
      <div className="mt-2 grid gap-1.5">{children}</div>
    </div>
  );
}

function Quiet({ children }: { children: ReactNode }) {
  return <p className="px-5 pb-5 text-2 text-neutral-11">{children}</p>;
}

function RowsSkeleton() {
  return (
    <div className="grid gap-3 px-5 pb-5">
      <div className="h-4 w-2/3 bg-muted" />
      <div className="h-4 w-1/2 bg-muted" />
      <div className="h-4 w-3/5 bg-muted" />
    </div>
  );
}

export function SpaceDashboard({ spaceSlug }: { spaceSlug: string }) {
  const locale = useLocale();
  const t = useTranslations('OverviewOps');
  const tCommon = useTranslations('Common');
  const tNav = useTranslations('SelectNavigationAction');
  const tCoherence = useTranslations('CoherenceTab');
  const { space } = useSpaceBySlug(spaceSlug);
  const { data: energy } = useSpaceEnergy();
  const {
    coherences,
    isLoading: signalsLoading,
    error: signalsError,
  } = useFindCoherences({ spaceSlug });
  const {
    persons,
    spaces: memberSpaces,
    isLoading: membersLoading,
  } = useMembers({
    spaceSlug,
    paginationDisabled: true,
  });
  const agents = useMobilizedAiAgents(spaceSlug);
  const { documents, isLoading: updatesLoading } =
    useSpaceDocumentsWithStatuses({
      spaceSlug,
      spaceId: space?.web3SpaceId,
    });

  const openSignals = useMemo(
    () => (coherences ?? []).filter((signal) => !signal.archived),
    [coherences],
  );

  const updates = useMemo(() => {
    const rows = [
      ...documents.onVoting,
      ...documents.accepted,
      ...documents.rejected,
    ];
    return rows
      .slice()
      .sort((left, right) => {
        const rank = (status?: string) => (status === 'onVoting' ? 0 : 1);
        const byStatus = rank(left.status) - rank(right.status);
        if (byStatus !== 0) return byStatus;
        return (
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime()
        );
      })
      .slice(0, 5);
  }, [documents]);

  const people = persons.data ?? [];
  const spaces = memberSpaces.data ?? [];

  const home = `/${locale}/dho/${spaceSlug}`;

  return (
    <div className="flex flex-col gap-4">
      {energy?.enabled ? <SpaceEnergySection /> : null}

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title={tCommon('Signals')}
          href={`${home}/coherence`}
          openLabel={t('open')}
        >
          <SignalHeatMaps
            signals={openSignals}
            isLoading={signalsLoading && !signalsError}
            empty={t('signalsEmpty')}
            hrefForPriority={(priority) =>
              `${home}/coherence?priority=${encodeURIComponent(priority)}`
            }
            hrefForType={(type) =>
              `${home}/coherence?type=${encodeURIComponent(type)}`
            }
          />
        </Panel>

        <Panel
          className="lg:col-span-2"
          title={tCommon('Calendar')}
          href={`${home}/calendar`}
          openLabel={t('open')}
        >
          <OverviewMonth spaceSlug={spaceSlug} />
        </Panel>
      </div>

      <SpaceAttention lang={locale as Locale} spaceSlug={spaceSlug} />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel
          title={t('recentActivityTitle')}
          href={`${home}/agreements`}
          openLabel={t('open')}
        >
          {updatesLoading ? (
            <RowsSkeleton />
          ) : updates.length === 0 ? (
            <Quiet>{t('noRecentActivity')}</Quiet>
          ) : (
            <SpaceActivityList
              items={updates}
              untitled={t('untitledProposal')}
              hrefFor={(slug) =>
                slug
                  ? `${home}/agreements/proposal/${slug}`
                  : `${home}/agreements`
              }
              statusLabel={(status) =>
                status === 'onVoting'
                  ? t('statusOnVoting')
                  : status === 'accepted'
                  ? t('statusAccepted')
                  : status === 'rejected'
                  ? t('statusRejected')
                  : ''
              }
            />
          )}
        </Panel>

        <Panel
          title={tCommon('Members')}
          href={`${home}/members`}
          openLabel={t('open')}
        >
          {membersLoading ? (
            <RowsSkeleton />
          ) : people.length === 0 &&
            spaces.length === 0 &&
            agents.length === 0 ? (
            <Quiet>{t('membersEmpty')}</Quiet>
          ) : (
            <div className="flex flex-col gap-5 px-5 pb-5">
              {people.length > 0 ? (
                <div className="flex items-center">
                  {people.slice(0, 8).map((person) => {
                    const name = personLabel(person);
                    return (
                      <Link
                        key={person.id}
                        href={
                          person.slug
                            ? `${home}/members/person/${person.slug}`
                            : `${home}/members`
                        }
                        title={name}
                        className="-ml-2 block rounded-full ring-2 ring-background-2 first:ml-0"
                      >
                        <PersonAvatar
                          avatarSrc={person.avatarUrl ?? undefined}
                          userName={name}
                          size="sm"
                          shape="circle"
                        />
                      </Link>
                    );
                  })}
                  {people.length > 8 ? (
                    <span className="ml-3 text-1 tabular-nums text-neutral-11">
                      +{people.length - 8}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {spaces.length > 0 ? (
                <MembershipPreview title={tCommon('Spaces')}>
                  {spaces.slice(0, 5).map((memberSpace) => (
                    <Link
                      key={memberSpace.id}
                      href={
                        memberSpace.slug
                          ? `/${locale}/dho/${memberSpace.slug}/overview`
                          : `${home}/members`
                      }
                      className="block truncate text-2 text-foreground hover:underline"
                    >
                      {memberSpace.title}
                    </Link>
                  ))}
                </MembershipPreview>
              ) : null}
              {agents.length > 0 ? (
                <MembershipPreview title={tNav('navigation.agents')}>
                  {agents.slice(0, 5).map((agent) => {
                    const name = tCoherence(agent.role);
                    return (
                      <span
                        key={agent.id}
                        className="inline-flex items-center gap-2 text-2 text-foreground"
                      >
                        <span
                          className={`flex size-6 shrink-0 items-center justify-center rounded-full text-1 ${tagGroupAccentClass(
                            agent.tagGroup,
                          )}`}
                        >
                          {getAgentAvatarInitials(name)}
                        </span>
                        {name}
                      </span>
                    );
                  })}
                </MembershipPreview>
              ) : null}
            </div>
          )}
        </Panel>

        <Panel
          className="lg:col-span-2"
          title={tNav('ecosystem')}
          href={`${home}/ecosystem-navigation`}
          openLabel={t('open')}
        >
          <EcosystemDiagram spaceSlug={spaceSlug} />
        </Panel>
      </div>
    </div>
  );
}
