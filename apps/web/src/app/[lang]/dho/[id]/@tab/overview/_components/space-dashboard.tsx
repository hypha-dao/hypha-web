'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import useSWR from 'swr';
import { UserEvent, type MatrixClient } from 'matrix-js-sdk';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  isCatalogueToken,
  isHyphaToken,
  useFindCoherences,
  useMatrix,
  useMatrixUserIdsByPersonIds,
  useMe,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import {
  PersonAvatar,
  readMemberPresence,
  useMemberDirectoryConnect,
  SignalCategoryTag,
  SpaceAttention,
  useDisplayCurrency,
  useSpaceDocumentsWithStatuses,
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

type Situation = 'back' | 'vote' | 'risk' | 'tension' | 'fresh' | 'quiet';

const GREETING = {
  back: ['greetingBackA', 'greetingBackB'],
  vote: ['greetingVoteA', 'greetingVoteB'],
  risk: ['greetingRiskA', 'greetingRiskB'],
  tension: ['greetingTensionA', 'greetingTensionB'],
  fresh: ['greetingFreshA', 'greetingFreshB'],
  quiet: ['greetingQuietA', 'greetingQuietB'],
} as const;

function turnStorageKey(personSlug: string, spaceSlug: string) {
  return `${visitStorageKey(personSlug, spaceSlug)}:turn`;
}

function readTurn(key: string) {
  try {
    const value = Number(window.localStorage.getItem(key) ?? '0');
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeTurn(key: string, turn: number) {
  try {
    window.localStorage.setItem(key, String(turn));
  } catch {
    // Private mode or quota — skip quietly.
  }
}

/** Survives a strict-mode remount so the briefing is not saved before it is read. */
const visitSnapshots = new Map<
  string,
  { previous: Date | null; turn: number }
>();
let visitGuard: string | null = null;

function stampOf(value: string | Date | null | undefined) {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function sameIds(left: Set<number>, right: Set<number>) {
  if (left.size !== right.size) return false;
  for (const id of left) {
    if (!right.has(id)) return false;
  }
  return true;
}

async function isSignedInNow(client: MatrixClient, matrixUserId: string) {
  const level = await readMemberPresence(client, matrixUserId);
  return level === 'active' || level === 'idle';
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
  const { person: me } = useMe();
  const { openChat, notice } = useMemberDirectoryConnect(people);
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
      <ul className="mt-2 flex flex-wrap items-center gap-2">
        {visible.map((person, index) => {
          const name = personLabel(person);
          const connected = onlineIds?.has(person.id) ?? false;
          const canChat = person.id !== me?.id;
          return (
            <li key={person.id} className="flex shrink-0 items-center">
              <button
                type="button"
                disabled={!canChat}
                title={connected ? `${name}. ${t('connectedNow')}` : name}
                aria-label={name}
                className="relative inline-flex rounded-full disabled:cursor-default"
                onClick={() => {
                  if (!canChat) return;
                  void openChat(person);
                }}
              >
                <span
                  className={
                    index === 0
                      ? 'inline-flex rounded-full ring-1 ring-foreground'
                      : 'inline-flex rounded-full'
                  }
                >
                  <PersonAvatar
                    avatarSrc={person.avatarUrl ?? undefined}
                    userName={name}
                    size="md"
                    shape="circle"
                  />
                </span>
                {connected ? (
                  <span
                    aria-hidden
                    className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-success-9 ring-2 ring-background"
                  />
                ) : null}
              </button>
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
      {notice ? (
        <p className="mt-2 text-1 text-error-11" role="alert">
          {notice}
        </p>
      ) : null}
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

const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function plainText(value: string) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[*_`>#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
      className={`craft-card flex min-w-0 flex-col p-4 ${className ?? ''}`}
    >
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

function Quiet({ children }: { children: ReactNode }) {
  return <p className="text-2 text-neutral-11">{children}</p>;
}

type TreasuryAsset = {
  symbol: string;
  value: number;
  usdEqual: number;
  address: string;
};

/** USDC, EURC, and the other catalogue assets that are not HYPHA. */
function isLiquidNonHypha(asset: TreasuryAsset) {
  return isCatalogueToken(asset.address) && !isHyphaToken(asset.address);
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
  const format = useFormatter();
  const t = useTranslations('OverviewOps');
  const tCommon = useTranslations('Common');
  const tNav = useTranslations('SelectNavigationAction');
  const tCoherence = useTranslations('CoherenceTab');
  const { formatFromUsd } = useDisplayCurrency();
  const { person } = useMe();
  const { getAccessToken } = useAuthentication();
  const { space } = useSpaceBySlug(spaceSlug);
  const { coherences, isLoading: signalsLoading } = useFindCoherences({
    spaceSlug,
  });
  const {
    persons,
    spaces: memberSpaces,
    isLoading: membersLoading,
  } = useMembers({
    spaceSlug,
    paginationDisabled: true,
  });
  const { documents, isLoading: updatesLoading } =
    useSpaceDocumentsWithStatuses({
      spaceSlug,
      spaceId: space?.web3SpaceId,
    });
  const [visit, setVisit] = useState<{
    previous: Date | null;
    turn: number;
  } | null>(null);

  useEffect(() => {
    if (!person?.slug) {
      setVisit({ previous: null, turn: 0 });
      return;
    }
    const id = `${person.slug}:${spaceSlug}`;
    const cached = visitSnapshots.get(id);
    if (visitGuard === id && cached) {
      setVisit(cached);
      const release = window.setTimeout(() => {
        visitSnapshots.delete(id);
        if (visitGuard === id) visitGuard = null;
      }, 400);
      return () => window.clearTimeout(release);
    }
    const key = visitStorageKey(person.slug, spaceSlug);
    const previous = readStoredVisit(key);
    const turn = readTurn(turnStorageKey(person.slug, spaceSlug)) + 1;
    const next = { previous, turn };
    visitSnapshots.set(id, next);
    visitGuard = id;
    setVisit(next);
    writeStoredVisit(key, new Date());
    writeTurn(turnStorageKey(person.slug, spaceSlug), turn);
    const release = window.setTimeout(() => {
      visitSnapshots.delete(id);
      if (visitGuard === id) visitGuard = null;
    }, 400);
    return () => window.clearTimeout(release);
  }, [person?.slug, spaceSlug]);

  const { data: treasury, isLoading: treasuryLoading } = useSWR(
    spaceSlug ? [`/api/v1/spaces/${spaceSlug}/assets?bestEffort=true`] : null,
    async ([endpoint]) => {
      const empty = { assets: [] as TreasuryAsset[], balance: 0 };
      const token = await getAccessToken();
      const headers: HeadersInit = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(endpoint, { headers });
      if (!response.ok) return empty;
      const body = (await response.json()) as {
        assets?: {
          symbol?: string;
          value?: number;
          usdEqual?: number;
          address?: string;
        }[];
        balance?: number;
      };
      const assets = (body.assets ?? []).flatMap((asset) => {
        if (!asset.symbol || !(asset.value && asset.value > 0)) return [];
        return [
          {
            symbol: asset.symbol,
            value: asset.value,
            usdEqual:
              typeof asset.usdEqual === 'number' &&
              Number.isFinite(asset.usdEqual)
                ? asset.usdEqual
                : 0,
            address: asset.address ?? '',
          },
        ];
      });
      const balance =
        typeof body.balance === 'number' && Number.isFinite(body.balance)
          ? body.balance
          : assets.reduce((sum, asset) => sum + asset.usdEqual, 0);
      return { assets, balance };
    },
    { revalidateOnFocus: false },
  );

  const openSignals = useMemo(
    () => (coherences ?? []).filter((signal) => !signal.archived),
    [coherences],
  );

  const recentActivity = useMemo(() => {
    const rows = [
      ...documents.accepted.map((item) => ({
        ...item,
        activityStatus: 'accepted' as const,
      })),
      ...documents.rejected.map((item) => ({
        ...item,
        activityStatus: 'rejected' as const,
      })),
      ...documents.onVoting.map((item) => ({
        ...item,
        activityStatus: 'onVoting' as const,
      })),
    ];
    return rows
      .sort(
        (left, right) =>
          (stampOf(right.createdAt) ?? 0) - (stampOf(left.createdAt) ?? 0),
      )
      .slice(0, 3);
  }, [documents.accepted, documents.onVoting, documents.rejected]);

  const weekSignals = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return openSignals
      .filter((signal) => (stampOf(signal.createdAt) ?? 0) >= cutoff)
      .sort(
        (left, right) =>
          (stampOf(right.createdAt) ?? 0) - (stampOf(left.createdAt) ?? 0),
      );
  }, [openSignals]);

  const people = persons.data ?? [];
  const spaces = memberSpaces.data ?? [];
  const assets = treasury?.assets ?? [];
  const treasuryBalance = treasury?.balance ?? 0;
  const spaceTokens = assets.filter((asset) => !isLiquidNonHypha(asset));
  const liquidTokens = assets.filter(isLiquidNonHypha);
  const distributionTokens =
    spaceTokens.length > 0 ? spaceTokens : liquidTokens;
  const assetTotal = distributionTokens.reduce(
    (sum, asset) => sum + asset.value,
    0,
  );
  const home = `/${locale}/dho/${spaceSlug}`;
  const turn = visit?.turn ?? 0;
  const name = person?.name?.trim() || person?.nickname?.trim() || '';
  const longAway =
    visit?.previous != null &&
    Date.now() - visit.previous.getTime() >= LONG_ABSENCE_MS;
  const riskCount = openSignals.filter(
    (signal) => signal.type === 'Risk',
  ).length;
  const tensionCount = openSignals.filter(
    (signal) => signal.type === 'Tension',
  ).length;
  const situation: Situation = longAway
    ? 'back'
    : documents.onVoting.length > 0
    ? 'vote'
    : riskCount > 0 && riskCount >= tensionCount
    ? 'risk'
    : tensionCount > 0
    ? 'tension'
    : weekSignals.length > 0
    ? 'fresh'
    : 'quiet';
  const sinceSignals =
    visit?.previous == null
      ? weekSignals
      : openSignals.filter(
          (signal) =>
            (stampOf(signal.createdAt) ?? 0) > visit.previous!.getTime(),
        );
  const sinceParts = [
    sinceSignals.length > 0
      ? t('briefSignals', { count: sinceSignals.length })
      : null,
    documents.onVoting.length > 0
      ? t('briefVotes', { count: documents.onVoting.length })
      : null,
  ].filter(Boolean);
  const sinceLine =
    visit?.previous == null
      ? t('briefFirst', { space: space?.title ?? spaceSlug })
      : sinceParts.length === 0
      ? t('briefQuiet')
      : t('briefSince', {
          date: format.dateTime(visit.previous, { dateStyle: 'medium' }),
          update: sinceParts.join(' · '),
        });
  const typeCounts = new Map<string, number>();
  for (const signal of openSignals) {
    typeCounts.set(signal.type, (typeCounts.get(signal.type) ?? 0) + 1);
  }
  let dominantType: string | null = null;
  let dominantCount = 0;
  for (const [type, count] of typeCounts) {
    if (count > dominantCount) {
      dominantType = type;
      dominantCount = count;
    }
  }
  const diagnosis =
    dominantType && dominantCount >= 2
      ? t('briefDiagnosis', {
          type: tCoherence.has(`types.${dominantType}` as 'types.Need')
            ? tCoherence(`types.${dominantType}` as 'types.Need')
            : dominantType,
        })
      : null;
  const linkedWeek = weekSignals.filter(
    (signal): signal is typeof signal & { slug: string } =>
      Boolean(signal.slug),
  );
  const nextSignal = linkedWeek[turn % Math.max(linkedWeek.length, 1)];
  const featuredSignals = [...openSignals]
    .filter((signal): signal is typeof signal & { slug: string } =>
      Boolean(signal.slug),
    )
    .sort((left, right) => {
      const rank =
        (PRIORITY_RANK[left.priority] ?? 2) -
        (PRIORITY_RANK[right.priority] ?? 2);
      if (rank !== 0) return rank;
      return (stampOf(right.createdAt) ?? 0) - (stampOf(left.createdAt) ?? 0);
    })
    .slice(0, 4);
  const showTreasury = treasuryLoading || assets.length > 0;
  const showEcosystem = spaces.length > 0 || space?.parentId != null;
  const showSignals = signalsLoading || featuredSignals.length > 0;
  const distributionSlices = distributionTokens.filter(
    (asset) => asset.value > 0,
  );

  return (
    <div className="flex flex-col gap-6">
      {name ? (
        <header className="flex min-w-0 flex-col gap-1 border-b-2 border-[color:var(--space-spot,var(--space-accent))] pb-3">
          <h1
            className="text-4 leading-tight text-foreground sm:text-5"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {t(GREETING[situation][turn % 2] ?? 'greetingQuietA', { name })}
          </h1>
          <p className="text-2 text-neutral-11">{sinceLine}</p>
          {diagnosis ? (
            <p className="text-2 text-[color:var(--space-spot,var(--space-accent))]">
              {diagnosis}
            </p>
          ) : null}
          {nextSignal?.slug ? (
            <Link
              href={`${home}/coherence?signal=${encodeURIComponent(
                nextSignal.slug,
              )}`}
              className="text-1 text-neutral-11 underline-offset-4 hover:text-foreground hover:underline"
            >
              {t('briefNext', { title: nextSignal.title })}
            </Link>
          ) : null}
        </header>
      ) : null}

      {membersLoading ? (
        <div className="flex gap-2" aria-hidden>
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

      <div
        className={
          showSignals
            ? 'grid items-start gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]'
            : 'grid items-start gap-3 lg:grid-cols-2'
        }
      >
        {showSignals ? (
          <div className="flex min-w-0 flex-col gap-6">
            <section className="min-w-0">
              <div className="flex w-fit max-w-full flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2
                  className="text-3 text-foreground"
                  style={{ fontFamily: 'var(--font-family-heading)' }}
                >
                  {t('signalsTitle')}
                </h2>
                <Link
                  href={`${home}/coherence`}
                  className="shrink-0 text-1 text-neutral-11 underline-offset-4 hover:text-foreground hover:underline"
                >
                  {t('open')}
                </Link>
              </div>
              {signalsLoading ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <RowsSkeleton />
                  <RowsSkeleton />
                </div>
              ) : (
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {featuredSignals.map((signal) => {
                    const body = plainText(signal.description);
                    return (
                      <li key={signal.slug}>
                        <Link
                          href={`${home}/coherence?signal=${encodeURIComponent(
                            signal.slug,
                          )}`}
                          className="craft-card-interactive flex h-full flex-col gap-2 p-4"
                        >
                          <SignalCategoryTag type={signal.type} withLabel />
                          <span className="text-2 text-foreground">
                            {signal.title}
                          </span>
                          {body ? (
                            <span className="line-clamp-4 text-1 text-neutral-11">
                              {body}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            {featuredSignals.length > 0 ? (
              <Panel
                title={t('insightsTitle')}
                href={`${home}/coherence`}
                openLabel={t('open')}
              >
                <div className="min-w-0 overflow-x-auto">
                  <SignalHeatMaps
                    signals={openSignals}
                    isLoading={signalsLoading}
                    empty={t('signalsEmpty')}
                    hrefForType={(type) =>
                      `${home}/coherence?type=${encodeURIComponent(type)}`
                    }
                  />
                </div>
              </Panel>
            ) : null}
          </div>
        ) : null}

        <div
          className={showSignals ? 'flex min-w-0 flex-col gap-3' : 'contents'}
        >
          <SpaceAttention
            lang={locale as Locale}
            spaceSlug={spaceSlug}
            turn={turn}
          />
          <section className="min-w-0">
            <div className="flex w-fit max-w-full flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2
                className="text-3 text-foreground"
                style={{ fontFamily: 'var(--font-family-heading)' }}
              >
                {t('lastActivityTitle')}
              </h2>
              <Link
                href={`${home}/agreements`}
                className="shrink-0 text-1 text-neutral-11 underline-offset-4 hover:text-foreground hover:underline"
              >
                {t('open')}
              </Link>
            </div>
            <div className="mt-3">
              {updatesLoading ? (
                <RowsSkeleton />
              ) : recentActivity.length === 0 ? (
                <Quiet>{t('noRecentActivity')}</Quiet>
              ) : (
                <SpaceActivityList
                  items={recentActivity}
                  untitled={t('untitledProposal')}
                  hrefFor={(slug) =>
                    slug
                      ? `${home}/agreements/proposal/${slug}`
                      : `${home}/agreements`
                  }
                  statusLabel={(status) =>
                    status === 'accepted'
                      ? t('statusAccepted')
                      : status === 'rejected'
                      ? t('statusRejected')
                      : t('statusOnVoting')
                  }
                />
              )}
            </div>
          </section>
          <OverviewMonth
            spaceSlug={spaceSlug}
            title={tCommon('Calendar')}
            href={`${home}/calendar`}
            openLabel={t('open')}
          />
        </div>
      </div>

      {showTreasury ? (
        <Panel
          title={t('treasuryTitle')}
          href={`${home}/treasury`}
          openLabel={t('open')}
        >
          {treasuryLoading ? (
            <RowsSkeleton />
          ) : assets.length === 0 ? (
            <Quiet>{t('treasuryEmpty')}</Quiet>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="min-w-0">
                <span
                  className="block truncate text-3 tabular-nums text-foreground"
                  style={{ fontFamily: 'var(--font-family-heading)' }}
                >
                  {formatFromUsd(treasuryBalance)}
                </span>
                <span className="mt-1 block truncate text-1 uppercase tracking-[0.12em] text-neutral-11">
                  {t('treasuryTotal')}
                </span>
              </div>
              {spaceTokens.length > 0 ? (
                <ul className="grid grid-cols-3 gap-3">
                  {spaceTokens.slice(0, 3).map((asset) => (
                    <li key={asset.symbol} className="min-w-0">
                      <span
                        className="block truncate text-3 tabular-nums text-foreground"
                        style={{ fontFamily: 'var(--font-family-heading)' }}
                      >
                        {format.number(asset.value, {
                          maximumFractionDigits: asset.value >= 100 ? 0 : 2,
                        })}
                      </span>
                      <span className="mt-1 block truncate text-1 text-neutral-11">
                        {asset.symbol}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {liquidTokens.length > 0 ? (
                <ul className="grid grid-cols-3 gap-3">
                  {liquidTokens.map((asset) => (
                    <li key={asset.address || asset.symbol} className="min-w-0">
                      <span
                        className="block truncate text-3 tabular-nums text-foreground"
                        style={{ fontFamily: 'var(--font-family-heading)' }}
                      >
                        {format.number(asset.value, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span className="mt-1 block truncate text-1 text-neutral-11">
                        {asset.symbol}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {distributionSlices.length > 1 && assetTotal > 0 ? (
                <div>
                  <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
                    {t('distributionTitle')}
                  </p>
                  <div className="mt-2 flex h-2 w-full overflow-hidden bg-neutral-3">
                    {distributionSlices.map((asset, index) => (
                      <span
                        key={asset.address || asset.symbol}
                        className="h-full bg-[color:var(--space-spot,var(--space-accent))]"
                        style={{
                          width: `${(asset.value / assetTotal) * 100}%`,
                          opacity:
                            1 - index * (0.55 / distributionSlices.length),
                        }}
                      />
                    ))}
                  </div>
                  <ul className="mt-2 grid gap-1">
                    {distributionSlices.map((asset) => (
                      <li
                        key={`share-${asset.address || asset.symbol}`}
                        className="flex min-w-0 items-baseline justify-between gap-3 text-1 text-neutral-11"
                      >
                        <span className="truncate">{asset.symbol}</span>
                        <span className="shrink-0 tabular-nums">
                          {format.number(asset.value / assetTotal, {
                            style: 'percent',
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </Panel>
      ) : null}

      {showEcosystem ? (
        <Panel
          title={tNav('ecosystem')}
          href={`${home}/ecosystem-navigation`}
          openLabel={t('open')}
        >
          {spaces.length > 0 ? (
            <p className="mb-3 text-2 text-neutral-11">
              {t('ecosystemNote', { count: spaces.length })}
            </p>
          ) : null}
          <EcosystemDiagram spaceSlug={spaceSlug} />
        </Panel>
      ) : null}
    </div>
  );
}
