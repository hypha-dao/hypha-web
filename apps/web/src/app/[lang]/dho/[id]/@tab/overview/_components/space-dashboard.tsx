'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useFindCoherences, useSpaceBySlug } from '@hypha-platform/core/client';
import {
  PersonAvatar,
  SpaceAttention,
  SpaceEnergySection,
  SpacePendingRewardsSection,
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
}: {
  title: string;
  href: string;
  openLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col border border-border bg-background">
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
  const tTreasury = useTranslations('TreasuryTab');
  const { space } = useSpaceBySlug(spaceSlug);
  const { data: energy } = useSpaceEnergy();
  const {
    coherences,
    isLoading: signalsLoading,
    error: signalsError,
  } = useFindCoherences({ spaceSlug });
  const { persons, isLoading: membersLoading } = useMembers({
    spaceSlug,
    page: 1,
    pageSize: 8,
  });
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
  const memberTotal = persons.pagination?.total ?? people.length;

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
          ) : people.length === 0 ? (
            <Quiet>{t('membersEmpty')}</Quiet>
          ) : (
            <div className="flex flex-col gap-4 px-4 py-4">
              <p className="text-4 font-medium tabular-nums text-foreground">
                {memberTotal}
              </p>
              <div className="flex flex-wrap gap-3">
                {people.map((person) => {
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
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title={tNav('ecosystem')}
          href={`${home}/ecosystem-navigation`}
          openLabel={t('open')}
        >
          <EcosystemDiagram spaceSlug={spaceSlug} />
        </Panel>
      </div>

      {space?.web3SpaceId != null ? (
        <Panel
          title={tTreasury('rewardsSection.title')}
          href={`${home}/rewards`}
          openLabel={t('open')}
        >
          <div className="px-4 py-4">
            <SpacePendingRewardsSection
              web3SpaceId={space.web3SpaceId}
              compactHeader
            />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
