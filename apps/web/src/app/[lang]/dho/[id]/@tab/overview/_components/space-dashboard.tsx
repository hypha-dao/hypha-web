'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import useSWR from 'swr';
import { ArrowRight } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  isCatalogueToken,
  isHyphaToken,
  useFindCoherences,
  useMe,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import {
  PersonAvatar,
  PresenceDot,
  presenceRank,
  useMemberDirectoryConnect,
  useMemberPresence,
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
/** Match home “Sensing who is around” portrait size. */
const PORTRAIT_PX = 32;
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
  const personIds = useMemo(() => people.map((person) => person.id), [people]);
  const { presenceById, isLoading: presenceLoading } =
    useMemberPresence(personIds);

  const ordered = useMemo(() => {
    if (presenceLoading) return people;
    return [...people].sort((left, right) => {
      return (
        presenceRank(presenceById.get(left.id) ?? 'offline') -
        presenceRank(presenceById.get(right.id) ?? 'offline')
      );
    });
  }, [people, presenceById, presenceLoading]);
  const visible = ordered.slice(0, VISIBLE_MEMBERS);
  const rest = ordered.length - visible.length;

  return (
    <nav aria-label={t('peopleHere')} className="mt-1 min-w-0 max-w-full pb-3">
      <p className="text-1 tracking-[0.12em] text-neutral-11 uppercase">
        {t('peopleHere')}
      </p>
      {presenceLoading ? (
        <div className="mt-2 flex gap-2" aria-hidden>
          {Array.from(
            { length: Math.min(VISIBLE_MEMBERS, people.length) },
            (_, index) => (
              <span
                key={index}
                className="animate-pulse rounded-full bg-neutral-3"
                style={{ width: PORTRAIT_PX, height: PORTRAIT_PX }}
              />
            ),
          )}
        </div>
      ) : (
        <ul className="mt-2 flex max-w-full flex-wrap items-center gap-2">
          {visible.map((person, index) => {
            const name = personLabel(person);
            const presence = presenceById.get(person.id) ?? 'offline';
            const around = presence === 'active' || presence === 'idle';
            const canChat = person.id !== me?.id;
            return (
              <li key={person.id} className="flex shrink-0 items-center">
                <button
                  type="button"
                  disabled={!canChat}
                  title={around ? `${name}. ${t('connectedNow')}` : name}
                  aria-label={name}
                  className="inline-flex rounded-full disabled:cursor-default"
                  onClick={() => {
                    if (!canChat) return;
                    void openChat(person);
                  }}
                >
                  <span className="relative inline-flex">
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
                    <PresenceDot level={presence} size="sm" />
                  </span>
                </button>
              </li>
            );
          })}
          {rest > 0 ? (
            <li>
              <Link
                href={membersHref}
                className="flex items-center justify-center rounded-full border border-neutral-7 text-1 text-neutral-12"
                style={{ width: PORTRAIT_PX, height: PORTRAIT_PX }}
              >
                +{rest}
              </Link>
            </li>
          ) : null}
        </ul>
      )}
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

/** Alternating light and dark mixes of the space hue so neighboring slices stay distinct. */
const DISTRIBUTION_FILLS = [
  'var(--space-spot, var(--space-accent))',
  'color-mix(in oklab, var(--space-spot, var(--space-accent)) 22%, white 78%)',
  'color-mix(in oklab, var(--space-spot, var(--space-accent)) 58%, black 42%)',
  'color-mix(in oklab, var(--space-spot, var(--space-accent)) 50%, white 50%)',
  'color-mix(in oklab, var(--space-spot, var(--space-accent)) 40%, black 60%)',
  'color-mix(in oklab, var(--space-spot, var(--space-accent)) 68%, white 32%)',
  'color-mix(in oklab, var(--space-spot, var(--space-accent)) 76%, black 24%)',
  'color-mix(in oklab, var(--space-spot, var(--space-accent)) 34%, white 66%)',
];

function pieWedge(start: number, end: number) {
  const radius = 1;
  const large = end - start > Math.PI ? 1 : 0;
  const x1 = Math.cos(start) * radius;
  const y1 = Math.sin(start) * radius;
  const x2 = Math.cos(end) * radius;
  const y2 = Math.sin(end) * radius;
  return `M 0 0 L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
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
  /** Greeting points at something — give it a way in (vote, tension, risk, signal). */
  const greetingHref = (() => {
    if (situation === 'vote') {
      const proposal = documents.onVoting.find((item) => item.slug?.trim());
      return proposal?.slug
        ? `${home}/agreements/proposal/${proposal.slug}`
        : `${home}/agreements`;
    }
    if (situation === 'risk' || situation === 'tension') {
      const type = situation === 'risk' ? 'Risk' : 'Tension';
      const signal = openSignals.find(
        (item) => item.type === type && item.slug?.trim(),
      );
      if (signal?.slug) {
        return `${home}/coherence?signal=${encodeURIComponent(signal.slug)}`;
      }
      return `${home}/coherence?type=${encodeURIComponent(type)}`;
    }
    if ((situation === 'fresh' || situation === 'back') && nextSignal?.slug) {
      return `${home}/coherence?signal=${encodeURIComponent(nextSignal.slug)}`;
    }
    return null;
  })();
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
  const distributionWedges = (() => {
    let cursor = -Math.PI / 2;
    return distributionSlices.map((asset, index) => {
      const share = assetTotal > 0 ? asset.value / assetTotal : 0;
      const start = cursor;
      const end = cursor + share * Math.PI * 2;
      cursor = end;
      return {
        key: asset.address || asset.symbol,
        symbol: asset.symbol,
        share,
        start,
        end,
        fill: DISTRIBUTION_FILLS[index % DISTRIBUTION_FILLS.length] ?? '',
      };
    });
  })();

  return (
    <div className="flex flex-col gap-6">
      {name ? (
        <header className="flex min-w-0 flex-col gap-1 border-b-2 border-[color:var(--space-spot,var(--space-accent))] pb-3">
          {greetingHref ? (
            <Link
              href={greetingHref}
              className="group inline-flex max-w-full items-baseline gap-2 text-foreground hover:text-[color:var(--space-spot,var(--space-accent))]"
            >
              <h1
                className="min-w-0 text-4 leading-tight sm:text-5"
                style={{ fontFamily: 'var(--font-family-heading)' }}
              >
                {t(GREETING[situation][turn % 2] ?? 'greetingQuietA', { name })}
              </h1>
              <ArrowRight
                className="size-5 shrink-0 translate-y-0.5 opacity-45 transition-opacity group-hover:opacity-100 sm:size-6"
                strokeWidth={1.5}
                aria-hidden
              />
            </Link>
          ) : (
            <h1
              className="text-4 leading-tight text-foreground sm:text-5"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {t(GREETING[situation][turn % 2] ?? 'greetingQuietA', { name })}
            </h1>
          )}
          <p className="text-2 text-neutral-11">{sinceLine}</p>
          {diagnosis ? (
            <p className="text-2 text-[color:var(--space-spot,var(--space-accent))]">
              {diagnosis}
            </p>
          ) : null}
          {nextSignal?.slug &&
          greetingHref !==
            `${home}/coherence?signal=${encodeURIComponent(
              nextSignal.slug,
            )}` ? (
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
        <div className="mt-1 min-w-0 max-w-full pb-3" aria-hidden>
          <div className="h-4 w-28 rounded bg-neutral-3" />
          <div className="mt-2 flex gap-2">
            {Array.from({ length: 5 }, (_, index) => (
              <span
                key={index}
                className="animate-pulse rounded-full bg-neutral-3"
                style={{ width: PORTRAIT_PX, height: PORTRAIT_PX }}
              />
            ))}
          </div>
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
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-4">
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
                      <li
                        key={asset.address || asset.symbol}
                        className="min-w-0"
                      >
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
              </div>
              {distributionWedges.length > 1 ? (
                <div className="flex shrink-0 items-center justify-end gap-4">
                  <svg
                    viewBox="-1.08 -1.08 2.16 2.16"
                    className="h-28 w-28 shrink-0"
                    role="img"
                    aria-label={t('distributionTitle')}
                  >
                    {distributionWedges.map((wedge) => (
                      <path
                        key={wedge.key}
                        d={pieWedge(wedge.start, wedge.end)}
                        fill={wedge.fill}
                        stroke="var(--background)"
                        strokeWidth={0.03}
                      >
                        <title>
                          {`${wedge.symbol} ${format.number(wedge.share, {
                            style: 'percent',
                            maximumFractionDigits: wedge.share < 0.01 ? 1 : 0,
                          })}`}
                        </title>
                      </path>
                    ))}
                  </svg>
                  <div className="min-w-[9rem]">
                    <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
                      {t('distributionTitle')}
                    </p>
                    <ul className="mt-2 grid gap-1">
                      {distributionWedges.map((wedge) => (
                        <li
                          key={`share-${wedge.key}`}
                          className="flex min-w-0 items-center gap-2 text-1 text-neutral-11"
                        >
                          <span
                            className="h-2 w-2 shrink-0"
                            style={{ background: wedge.fill }}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {wedge.symbol}
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {format.number(wedge.share, {
                              style: 'percent',
                              maximumFractionDigits: wedge.share < 0.01 ? 1 : 0,
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
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
