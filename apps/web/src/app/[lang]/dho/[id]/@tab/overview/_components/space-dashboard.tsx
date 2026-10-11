'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  COHERENCE_TYPES,
  useFindCoherences,
  useOrganisationSpacesBySingleSlug,
  useScheduledItems,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import {
  PersonAvatar,
  SpaceEnergySection,
  SpacePendingRewardsSection,
  useSpaceDocumentsWithStatuses,
  useSpaceEnergy,
} from '@hypha-platform/epics';
import { cn } from '@hypha-platform/ui-utils';

import { useMembers } from '@web/hooks/use-members';

const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-error-9',
  high: 'bg-warning-9',
  medium: 'bg-accent-9',
  low: 'bg-neutral-7',
};

function excerpt(value: string | null | undefined) {
  const text = (value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= 110) return text;
  return `${text.slice(0, 109).trimEnd()}…`;
}

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
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-1 font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </h2>
        <Link
          href={href}
          className="text-1 text-foreground underline-offset-4 hover:underline"
        >
          {openLabel}
        </Link>
      </div>
      {children}
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
  const tSignals = useTranslations('CoherenceTab');
  const { space } = useSpaceBySlug(spaceSlug);
  const { data: energy } = useSpaceEnergy();
  const {
    coherences,
    isLoading: signalsLoading,
    error: signalsError,
  } = useFindCoherences({ spaceSlug });
  const range = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 21);
    return { from, to };
  }, []);
  const { scheduledItems, isLoading: calendarLoading } = useScheduledItems({
    spaceSlug,
    from: range.from,
    to: range.to,
  });
  const { persons, isLoading: membersLoading } = useMembers({
    spaceSlug,
    page: 1,
    pageSize: 8,
  });
  const { spaces: ecosystemSpaces, isLoading: ecosystemLoading } =
    useOrganisationSpacesBySingleSlug(spaceSlug);
  const { documents, isLoading: updatesLoading } =
    useSpaceDocumentsWithStatuses({
      spaceSlug,
      spaceId: space?.web3SpaceId,
    });

  const openSignals = useMemo(() => {
    const rank = (priority: string) => PRIORITY_RANK[priority] ?? 4;
    return (coherences ?? [])
      .filter((signal) => !signal.archived)
      .slice()
      .sort((left, right) => {
        const byPriority = rank(left.priority) - rank(right.priority);
        if (byPriority !== 0) return byPriority;
        return (
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime()
        );
      });
  }, [coherences]);

  const signalCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const signal of openSignals) {
      counts.set(signal.type, (counts.get(signal.type) ?? 0) + 1);
    }
    return COHERENCE_TYPES.flatMap((type) => {
      const count = counts.get(type) ?? 0;
      return count > 0 ? [{ type, count }] : [];
    });
  }, [openSignals]);

  const leadSignals = openSignals.slice(0, 4);

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

  const upcoming = useMemo(() => {
    const now = Date.now();
    return (scheduledItems ?? [])
      .filter((item) => item.endsAt.getTime() >= now)
      .slice()
      .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())
      .slice(0, 4);
  }, [scheduledItems]);

  const people = persons.data ?? [];
  const memberTotal = persons.pagination?.total ?? people.length;
  const relatedSpaces = (ecosystemSpaces ?? [])
    .filter((item) => item.slug && item.slug !== spaceSlug)
    .slice(0, 6);

  const home = `/${locale}/dho/${spaceSlug}`;
  const when = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const clock = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="flex flex-col gap-6">
      {energy?.enabled ? <SpaceEnergySection /> : null}

      {signalsError ? null : (
        <Panel
          title={tCommon('Signals')}
          href={`${home}/coherence`}
          openLabel={t('open')}
        >
          {signalsLoading ? (
            <RowsSkeleton />
          ) : openSignals.length === 0 ? (
            <Quiet>{t('signalsEmpty')}</Quiet>
          ) : (
            <>
              {signalCounts.length > 0 ? (
                <div className="flex flex-wrap border-b border-border">
                  {signalCounts.map((item) => (
                    <Link
                      key={item.type}
                      href={`${home}/coherence?type=${encodeURIComponent(
                        item.type,
                      )}`}
                      className="flex flex-1 items-baseline justify-between gap-3 border-r border-border px-4 py-3 last:border-r-0 hover:bg-foreground/5"
                      style={{ minWidth: 128 }}
                    >
                      <span className="truncate text-1 uppercase tracking-[0.12em] text-muted-foreground">
                        {tSignals(`types.${item.type}` as 'types.Need')}
                      </span>
                      <span className="text-4 font-medium tabular-nums text-foreground">
                        {item.count}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-col border-t border-border">
                {leadSignals.map((signal) => (
                  <Link
                    key={signal.id}
                    href={
                      signal.slug
                        ? `${home}/coherence?signal=${encodeURIComponent(
                            signal.slug,
                          )}`
                        : `${home}/coherence`
                    }
                    className="grid gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-foreground/5"
                    style={{ gridTemplateColumns: 'auto minmax(0, 1fr)' }}
                  >
                    <span
                      className={cn(
                        'mt-2 size-1.5 rounded-full',
                        PRIORITY_DOT[signal.priority] ?? PRIORITY_DOT.medium,
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-2 text-foreground">
                        {signal.title}
                      </span>
                      {excerpt(signal.description) ? (
                        <span className="mt-1 block text-1 text-neutral-11">
                          {excerpt(signal.description)}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </Panel>
      )}

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
            updates.map((item) => (
              <Link
                key={item.id}
                href={
                  item.slug
                    ? `${home}/agreements/proposal/${item.slug}`
                    : `${home}/agreements`
                }
                className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-foreground/5"
              >
                <span className="min-w-0 truncate text-2 text-foreground">
                  {item.title?.trim() || t('untitledProposal')}
                </span>
                <span className="shrink-0 text-1 text-neutral-11">
                  {item.status === 'onVoting'
                    ? t('statusOnVoting')
                    : item.status === 'accepted'
                    ? t('statusAccepted')
                    : item.status === 'rejected'
                    ? t('statusRejected')
                    : ''}
                </span>
              </Link>
            ))
          )}
        </Panel>

        <Panel
          title={tCommon('Calendar')}
          href={`${home}/calendar`}
          openLabel={t('open')}
        >
          {calendarLoading ? (
            <RowsSkeleton />
          ) : upcoming.length === 0 ? (
            <Quiet>{t('calendarEmpty')}</Quiet>
          ) : (
            upcoming.map((item) => (
              <Link
                key={item.id}
                href={`${home}/calendar`}
                className="grid gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-foreground/5"
                style={{ gridTemplateColumns: '7.5rem minmax(0, 1fr)' }}
              >
                <span className="text-1 text-neutral-11">
                  {when.format(item.startsAt)}
                  {item.allDay ? null : (
                    <span className="mt-1 block">
                      {clock.format(item.startsAt)}
                    </span>
                  )}
                </span>
                <span className="min-w-0 truncate text-2 text-foreground">
                  {item.title}
                </span>
              </Link>
            ))
          )}
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
          {ecosystemLoading ? (
            <RowsSkeleton />
          ) : relatedSpaces.length === 0 ? (
            <Quiet>{t('ecosystemEmpty')}</Quiet>
          ) : (
            relatedSpaces.map((item) => (
              <Link
                key={item.id}
                href={`/${locale}/dho/${item.slug}/overview`}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-foreground/5"
              >
                <PersonAvatar
                  avatarSrc={item.logoUrl ?? undefined}
                  userName={item.title}
                  size="sm"
                  shape="circle"
                />
                <span className="min-w-0 truncate text-2 text-foreground">
                  {item.title}
                </span>
              </Link>
            ))
          )}
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
