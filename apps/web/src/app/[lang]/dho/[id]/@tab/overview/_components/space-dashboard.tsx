'use client';

import Link from 'next/link';
import { Children, useMemo, type ReactNode } from 'react';
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
      className={`flex min-w-0 flex-col border border-border bg-background ${
        className ?? ''
      }`}
    >
      <div className="flex items-baseline justify-between gap-4 px-4 pt-4">
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
      <div className="mt-3 min-w-0">{children}</div>
    </section>
  );
}

function MembershipPreview({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: ReactNode;
}) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <div>
      <p className="text-1 text-neutral-11">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-1 text-neutral-11">{empty}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-3">{items}</div>
      )}
    </div>
  );
}

function Quiet({ children }: { children: ReactNode }) {
  return <p className="px-4 py-4 text-2 text-neutral-11">{children}</p>;
}

function RowsSkeleton() {
  return (
    <div className="grid gap-3 px-4 py-4">
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
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      )
      .slice(0, 5);
  }, [documents]);

  const people = persons.data ?? [];
  const spaces = memberSpaces.data ?? [];

  const home = `/${locale}/dho/${spaceSlug}`;

  return (
    <div className="flex flex-col gap-8">
      {energy?.enabled ? <SpaceEnergySection /> : null}

      {signalsError ? null : (
        <Panel
          title={tCommon('Signals')}
          href={`${home}/coherence`}
          openLabel={t('open')}
        >
          <SignalHeatMaps
            signals={openSignals}
            isLoading={signalsLoading}
            empty={t('signalsEmpty')}
            hrefForType={(type) =>
              `${home}/coherence?type=${encodeURIComponent(type)}`
            }
          />
        </Panel>
      )}

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
          title={tCommon('Calendar')}
          href={`${home}/calendar`}
          openLabel={t('open')}
        >
          <OverviewMonth spaceSlug={spaceSlug} />
        </Panel>

        <Panel
          title={tCommon('Members')}
          href={`${home}/members`}
          openLabel={t('open')}
        >
          {membersLoading ? (
            <RowsSkeleton />
          ) : (
            <div className="flex flex-col gap-5 px-4 pb-4">
              <MembershipPreview
                title={tCommon('Members')}
                empty={tNav('navigation.noIndividuals')}
              >
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
                      className="flex min-w-0 items-center gap-2"
                    >
                      <PersonAvatar
                        avatarSrc={person.avatarUrl ?? undefined}
                        userName={name}
                        size="sm"
                        shape="circle"
                      />
                      <span className="max-w-[9rem] truncate text-1 text-foreground">
                        {name}
                      </span>
                    </Link>
                  );
                })}
              </MembershipPreview>
              <MembershipPreview
                title={tCommon('Spaces')}
                empty={tNav('navigation.noMemberSpaces')}
              >
                {spaces.slice(0, 8).map((memberSpace) => (
                  <Link
                    key={memberSpace.id}
                    href={
                      memberSpace.slug
                        ? `/${locale}/dho/${memberSpace.slug}/overview`
                        : `${home}/members`
                    }
                    className="flex min-w-0 items-center gap-2"
                  >
                    <PersonAvatar
                      avatarSrc={memberSpace.logoUrl ?? undefined}
                      userName={memberSpace.title}
                      size="sm"
                      shape="circle"
                    />
                    <span className="max-w-[9rem] truncate text-1 text-foreground">
                      {memberSpace.title}
                    </span>
                  </Link>
                ))}
              </MembershipPreview>
              <MembershipPreview
                title={tNav('navigation.agents')}
                empty={tNav('navigation.noAgents')}
              >
                {agents.slice(0, 8).map((agent) => {
                  const name = tCoherence(agent.role);
                  return (
                    <span
                      key={agent.id}
                      className="flex min-w-0 items-center gap-2"
                    >
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${tagGroupAccentClass(
                          agent.tagGroup,
                        )}`}
                      >
                        {getAgentAvatarInitials(name)}
                      </span>
                      <span className="max-w-[9rem] truncate text-1 text-foreground">
                        {name}
                      </span>
                    </span>
                  );
                })}
              </MembershipPreview>
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
