'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { UserEvent, type MatrixClient } from 'matrix-js-sdk';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import {
  useFindCoherences,
  useMatrix,
  useMatrixUserIdsByPersonIds,
  useMe,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
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

const VISIBLE_MEMBERS = 8;
/** A week or more away is enough for a warm welcome back. No judgment. */
const LONG_ABSENCE_MS = 7 * 24 * 60 * 60 * 1000;

function visitStorageKey(personSlug: string, spaceSlug: string) {
  return `hypha.space-dashboard-visit:${personSlug}:${spaceSlug}`;
}

function readStoredVisit(key: string): Date | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function writeStoredVisit(key: string, date: Date) {
  try {
    window.localStorage.setItem(key, date.toISOString());
  } catch {
    // Private mode or quota — skip quietly.
  }
}

function greetingTimeKey(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'greetingMorning' as const;
  if (hour < 18) return 'greetingAfternoon' as const;
  return 'greetingEvening' as const;
}

function SpaceDashboardGreeting({ spaceSlug }: { spaceSlug: string }) {
  const t = useTranslations('OverviewOps');
  const format = useFormatter();
  const { person, isLoading } = useMe();
  const [previousVisit, setPreviousVisit] = useState<Date | null>(null);
  const [visitReady, setVisitReady] = useState(false);

  useEffect(() => {
    if (!person?.slug) {
      setPreviousVisit(null);
      setVisitReady(true);
      return;
    }
    const key = visitStorageKey(person.slug, spaceSlug);
    const previous = readStoredVisit(key);
    setPreviousVisit(previous);
    setVisitReady(true);
    writeStoredVisit(key, new Date());
  }, [person?.slug, spaceSlug]);

  if (isLoading || !person) return null;
  const name = person.name?.trim() || person.nickname?.trim();
  if (!name) return null;

  const longAway =
    visitReady &&
    previousVisit != null &&
    Date.now() - previousVisit.getTime() >= LONG_ABSENCE_MS;

  return (
    <header className="flex min-w-0 flex-col gap-1">
      <h1
        className="text-5 leading-tight text-foreground sm:text-6"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {longAway
          ? t('greetingBack', { name })
          : t(greetingTimeKey(), { name })}
      </h1>
      {longAway && previousVisit ? (
        <p className="text-2 text-neutral-11">
          {t('greetingLastHere', {
            date: format.dateTime(previousVisit, { dateStyle: 'medium' }),
          })}
        </p>
      ) : null}
    </header>
  );
}

function sameIds(left: Set<number>, right: Set<number>) {
  if (left.size !== right.size) return false;
  for (const id of left) {
    if (!right.has(id)) return false;
  }
  return true;
}

async function isSignedInNow(client: MatrixClient, matrixUserId: string) {
  try {
    const status = await client.getPresence(matrixUserId);
    return status.presence === 'online' || Boolean(status.currently_active);
  } catch {
    return false;
  }
}

function SpaceMemberCircles({
  people,
  membersHref,
}: {
  people: Array<{
    id: number;
    slug?: string | null;
    avatarUrl?: string | null;
    name?: string | null;
    surname?: string | null;
    nickname?: string | null;
  }>;
  membersHref: string;
}) {
  const t = useTranslations('OverviewOps');
  const matrix = useMatrix();
  const personIds = useMemo(() => people.map((person) => person.id), [people]);
  const { personIdToMatrixUserId, isLoading: matrixIdsLoading } =
    useMatrixUserIdsByPersonIds({ personIds });
  const [onlineIds, setOnlineIds] = useState<Set<number> | null>(null);

  useEffect(() => {
    const client = matrix.client;
    if (personIds.length === 0) {
      setOnlineIds((current) =>
        current && current.size === 0 ? current : new Set(),
      );
      return;
    }
    if (!client || !matrix.isAuthenticated || matrixIdsLoading) return;

    let cancelled = false;
    let timer = 0;
    const recompute = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void (async () => {
          const next = new Set<number>();
          await Promise.all(
            personIds.map(async (personId) => {
              const matrixUserId = personIdToMatrixUserId[personId];
              if (!matrixUserId) return;
              if (await isSignedInNow(client, matrixUserId)) next.add(personId);
            }),
          );
          if (cancelled) return;
          setOnlineIds((current) =>
            current && sameIds(current, next) ? current : next,
          );
        })();
      }, 250);
    };

    recompute();
    const interval = window.setInterval(recompute, 30_000);
    client.on(UserEvent.Presence, recompute);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(interval);
      client.removeListener(UserEvent.Presence, recompute);
    };
  }, [
    matrix.client,
    matrix.isAuthenticated,
    matrixIdsLoading,
    personIdToMatrixUserId,
    personIds,
  ]);

  const ordered = useMemo(() => {
    if (!onlineIds || onlineIds.size === 0) return people;
    return [...people].sort((left, right) => {
      const leftOn = onlineIds.has(left.id) ? 0 : 1;
      const rightOn = onlineIds.has(right.id) ? 0 : 1;
      return leftOn - rightOn;
    });
  }, [onlineIds, people]);
  const visible = ordered.slice(0, VISIBLE_MEMBERS);
  const rest = ordered.length - visible.length;

  return (
    <nav aria-label={t('peopleHere')}>
      <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
        {t('peopleHere')}
      </p>
      <ul className="mt-3 flex flex-wrap items-start gap-4">
        {visible.map((person) => {
          const name = personLabel(person);
          const given = person.name?.trim() || name;
          const connected = onlineIds?.has(person.id) ?? false;
          return (
            <li
              key={person.id}
              className="flex w-14 flex-col items-center gap-1.5"
            >
              <Link
                href={
                  person.slug
                    ? `${membersHref}/person/${person.slug}`
                    : membersHref
                }
                title={connected ? `${name}. ${t('connectedNow')}` : name}
                className="relative inline-flex rounded-full"
              >
                <PersonAvatar
                  avatarSrc={person.avatarUrl ?? undefined}
                  userName={name}
                  size="md"
                  shape="circle"
                />
                {connected ? (
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-success-9 ring-2 ring-background"
                  />
                ) : null}
              </Link>
              <span className="w-full truncate text-center text-1 text-neutral-11">
                {given}
              </span>
            </li>
          );
        })}
        {rest > 0 ? (
          <li>
            <Link
              href={membersHref}
              className="flex items-center justify-center rounded-full border border-neutral-7 text-1 text-foreground"
              style={{ width: 32, height: 32 }}
            >
              +{rest}
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
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
  className,
}: {
  title: string;
  href: string;
  openLabel: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col ${className ?? ''}`}>
      <div className="flex w-fit max-w-full flex-wrap items-baseline gap-x-3 gap-y-1">
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
  return <p className="text-2 text-neutral-11">{children}</p>;
}

function RowsSkeleton() {
  return (
    <div className="grid gap-3">
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

  const openVotes = useMemo(
    () =>
      documents.onVoting
        .slice()
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
        )
        .slice(0, 4),
    [documents.onVoting],
  );

  const people = persons.data ?? [];
  const spaces = memberSpaces.data ?? [];

  const home = `/${locale}/dho/${spaceSlug}`;

  return (
    <div className="flex flex-col gap-4">
      <SpaceDashboardGreeting spaceSlug={spaceSlug} />

      {membersLoading ? (
        <div className="flex gap-4" aria-hidden>
          {Array.from({ length: 5 }, (_, index) => (
            <span
              key={index}
              className="rounded-full bg-neutral-3"
              style={{ width: 32, height: 32 }}
            />
          ))}
        </div>
      ) : people.length > 0 ? (
        <SpaceMemberCircles people={people} membersHref={`${home}/members`} />
      ) : null}

      {energy?.enabled ? <SpaceEnergySection /> : null}

      <SpaceAttention lang={locale as Locale} spaceSlug={spaceSlug} />

      <div className="flex flex-wrap gap-x-8 gap-y-3">
        {signalsLoading || updatesLoading || membersLoading
          ? [0, 1, 2].map((cell) => (
              <div key={cell}>
                <span className="block h-8 w-10 bg-neutral-3" />
                <span className="mt-2 block h-3 w-16 bg-neutral-3" />
              </div>
            ))
          : (
              [
                {
                  href: `${home}/coherence`,
                  count: openSignals.length,
                  label: tCommon('Signals'),
                },
                {
                  href: `${home}/agreements`,
                  count: documents.onVoting.length,
                  label: t('openVotesTitle'),
                },
                {
                  href: `${home}/members`,
                  count: people.length,
                  label: tCommon('Members'),
                },
              ] as const
            ).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="min-w-0 hover:opacity-80"
              >
                <span
                  className="block text-5 tabular-nums text-foreground"
                  style={{ fontFamily: 'var(--font-family-heading)' }}
                >
                  {item.count}
                </span>
                <span className="mt-1 block text-1 text-neutral-11">
                  {item.label}
                </span>
              </Link>
            ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <Panel
          title={tCommon('Signals')}
          href={`${home}/coherence`}
          openLabel={t('open')}
        >
          <SignalHeatMaps
            signals={openSignals}
            isLoading={signalsLoading && !signalsError}
            empty={t('signalsEmpty')}
            hrefForType={(type) =>
              `${home}/coherence?type=${encodeURIComponent(type)}`
            }
          />
        </Panel>

        <Panel
          title={tCommon('Calendar')}
          href={`${home}/calendar`}
          openLabel={t('open')}
        >
          <OverviewMonth spaceSlug={spaceSlug} />
        </Panel>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel
          title={t('openVotesTitle')}
          href={`${home}/agreements`}
          openLabel={t('open')}
        >
          {updatesLoading ? (
            <RowsSkeleton />
          ) : openVotes.length === 0 ? (
            <Quiet>{t('noOpenVotesNow')}</Quiet>
          ) : (
            <SpaceActivityList
              items={openVotes}
              untitled={t('untitledProposal')}
              hrefFor={(slug) =>
                slug
                  ? `${home}/agreements/proposal/${slug}`
                  : `${home}/agreements`
              }
              statusLabel={() => t('statusOnVoting')}
            />
          )}
        </Panel>

        {!membersLoading &&
        (spaces.length > 0 || agents.length > 0 || people.length === 0) ? (
          <Panel
            title={tCommon('Members')}
            href={`${home}/members`}
            openLabel={t('open')}
          >
            {people.length === 0 &&
            spaces.length === 0 &&
            agents.length === 0 ? (
              <Quiet>{t('membersEmpty')}</Quiet>
            ) : (
              <div className="flex flex-col gap-5">
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
        ) : null}

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
