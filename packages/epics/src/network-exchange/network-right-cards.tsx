'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import useSWR from 'swr';
import { ArrowUpRight, ChevronDown, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@hypha-platform/ui';
import { useAuthentication } from '@hypha-platform/authentication';
import type { Locale } from '@hypha-platform/i18n';
import {
  CAPITALS,
  CATEGORIES,
  collapseCategoriesToGroups,
  DEFAULT_SPACE_LEAD_IMAGE,
  getCategoryGroupLabel,
  NETWORK_FIELD_KINDS,
  parseCapitalKeys,
  type CapitalKey,
  type Category,
  type NetworkFieldPayout,
  type NetworkFieldSignalKind,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { useHumanChatPanel } from '../common/human-chat-panel-context';
import { CAPITAL_MARK } from './capital-marks';
import { useMemberNamedSpaces } from './use-member-named-spaces';

export type NetworkRailSpace = {
  slug: string;
  title: string;
  description: string;
  place: string;
  leadImage: string | null;
  chatRoomId: string | null;
  categories?: string[];
  seeks: string[];
  offers: string[];
};

type TreasuryAsset = { symbol: string; value: number };

function stripTags(value: string) {
  let out = '';
  let index = 0;
  while (index < value.length) {
    const open = value.indexOf('<', index);
    if (open === -1) {
      out += value.slice(index);
      break;
    }
    out += value.slice(index, open);
    const close = value.indexOf('>', open + 1);
    if (close === -1) {
      out += value.slice(open);
      break;
    }
    out += ' ';
    index = close + 1;
  }
  return out;
}

function excerpt(value: string | null | undefined) {
  const text = stripTags(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= 220) return text;
  return `${text.slice(0, 219).trimEnd()}…`;
}

function leadImageSrc(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  if (trimmed.startsWith('/') || trimmed.startsWith('https://')) return trimmed;
  return DEFAULT_SPACE_LEAD_IMAGE;
}

function readablePlace(label: string) {
  const match = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(label);
  if (!match) return label;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return label;
  const north = latitude >= 0 ? 'N' : 'S';
  const east = longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(latitude).toFixed(2)}° ${north}, ${Math.abs(
    longitude,
  ).toFixed(2)}° ${east}`;
}

function categoryEyebrow(categories: string[] | undefined, project: string) {
  const known = (categories ?? []).filter((value): value is Category =>
    (CATEGORIES as readonly string[]).includes(value),
  );
  const group = collapseCategoriesToGroups(known)[0];
  if (!group) return project;
  return `${project} · ${getCategoryGroupLabel(group)}`;
}

function formatAmount(value: number, lang: string) {
  return new Intl.NumberFormat(lang, {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function payoutFigures(amount: string, lang: string) {
  const normalized = amount.trim().replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return amount.trim();
  const value = Number(normalized);
  if (!Number.isFinite(value)) return amount.trim();
  return formatAmount(value, lang);
}

function tokenUnit(token: string) {
  const trimmed = token.trim();
  if (/^hypha$/i.test(trimmed)) return 'HYPHA';
  if (trimmed.startsWith('0x') && trimmed.length > 10) {
    return `${trimmed.slice(0, 8)}…`;
  }
  return trimmed;
}

function signalKindLabel(
  t: ReturnType<typeof useTranslations<'NetworkExchange'>>,
  option: NetworkFieldSignalKind,
) {
  if (option === 'Need') return t('filterNeed');
  if (option === 'Opportunity') return t('filterOpportunity');
  if (option === 'Risk') return t('filterRisk');
  if (option === 'Tension') return t('filterTension');
  if (option === 'Insight') return t('filterInsight');
  if (option === 'Action') return t('filterAction');
  return t('filterImpact');
}

function useSpaceTreasury(slug: string | null) {
  const { getAccessToken } = useAuthentication();
  const { data, isLoading } = useSWR(
    slug ? [`/api/v1/spaces/${slug}/assets?bestEffort=true`] : null,
    async ([endpoint]) => {
      const token = await getAccessToken();
      const headers: HeadersInit = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(endpoint, { headers });
      if (!response.ok) return [] as TreasuryAsset[];
      const body = (await response.json()) as {
        assets?: { symbol?: string; value?: number }[];
      };
      return (body.assets ?? []).flatMap((asset) => {
        if (!asset.symbol || !(asset.value && asset.value > 0)) return [];
        return [{ symbol: asset.symbol, value: asset.value }];
      });
    },
    { revalidateOnFocus: false },
  );
  return { assets: data ?? [], isLoading: Boolean(slug) && isLoading };
}

function Shell({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border bg-background p-4">
      <h2
        className="text-3"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {title}
      </h2>
      <p className="mt-2 text-1 leading-relaxed text-neutral-11">{body}</p>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

function CapitalLine({ keys }: { keys: CapitalKey[] }) {
  const t = useTranslations('NetworkExchange');
  if (keys.length === 0) {
    return <p className="mt-2 text-1 text-neutral-11">{t('noneYet')}</p>;
  }
  return (
    <ul className="mt-2 grid gap-1.5">
      {keys.map((key) => (
        <li key={key} className="flex items-center gap-2 text-1">
          <span className="w-3 shrink-0 text-center" aria-hidden>
            {CAPITAL_MARK[key]}
          </span>
          {t(`capitals.${key}`)}
        </li>
      ))}
    </ul>
  );
}

function SpaceSelect({
  spaces,
  value,
  onChange,
  exclude,
}: {
  spaces: NetworkRailSpace[];
  value: string;
  onChange: (slug: string) => void;
  exclude?: string[];
}) {
  const options = spaces.filter((space) => !exclude?.includes(space.slug));
  return (
    <select
      value={value}
      onChange={(event) => {
        const match = options.find(
          (space) => space.slug === event.target.value,
        );
        if (match) onChange(match.slug);
      }}
      className="h-10 w-full border border-border bg-neutral-2 px-2 text-2 text-foreground"
    >
      {options.map((space) => (
        <option key={space.slug} value={space.slug}>
          {space.title}
        </option>
      ))}
    </select>
  );
}

function CapitalChips({
  value,
  onChange,
}: {
  value: CapitalKey[];
  onChange: (next: CapitalKey[]) => void;
}) {
  const t = useTranslations('NetworkExchange');
  return (
    <div className="flex flex-wrap gap-1">
      {CAPITALS.map((key) => {
        const on = value.includes(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() =>
              onChange(
                on ? value.filter((item) => item !== key) : [...value, key],
              )
            }
            className={cn(
              'border px-2 py-1 text-1',
              on
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-neutral-11',
            )}
          >
            <span aria-hidden>{CAPITAL_MARK[key]} </span>
            {t(`capitals.${key}`)}
          </button>
        );
      })}
    </div>
  );
}

function SpaceCard({ lang, space }: { lang: Locale; space: NetworkRailSpace }) {
  const t = useTranslations('NetworkExchange');
  const { openCoherenceChat, openHumanChatPanel } = useHumanChatPanel();
  const { assets, isLoading } = useSpaceTreasury(space.slug);
  const [expanded, setExpanded] = useState(false);
  const seeks = parseCapitalKeys(space.seeks);
  const offers = parseCapitalKeys(space.offers);
  const summary = excerpt(space.description);
  const place = readablePlace(space.place.trim());
  const shown = expanded ? assets : assets.slice(0, 4);
  const hidden = Math.max(0, assets.length - shown.length);

  return (
    <section className="border border-border bg-background">
      <div className="relative h-48 overflow-hidden bg-neutral-3">
        <img
          src={leadImageSrc(space.leadImage)}
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-4 pb-4 text-white">
          <p className="text-1 uppercase tracking-[0.12em] text-white/80">
            {categoryEyebrow(space.categories, t('projectSpace'))}
          </p>
          <h2
            className="mt-1 text-6 font-medium leading-tight tracking-[-0.02em]"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {space.title}
          </h2>
          {place ? <p className="mt-1 text-1 text-white/80">{place}</p> : null}
        </div>
      </div>
      {summary ? (
        <p className="px-4 pt-4 text-1 leading-relaxed text-neutral-11">
          {summary}
        </p>
      ) : null}
      <div className="px-4 pt-4">
        <p className="flex items-center gap-2 text-1 uppercase tracking-[0.12em] text-neutral-11">
          <Wallet className="size-3.5" aria-hidden />
          {t('treasuryLive')}
        </p>
        {isLoading ? (
          <p className="mt-3 text-1 text-neutral-11">{t('noneYet')}</p>
        ) : shown.length > 0 ? (
          <>
            <div className="mt-3 grid grid-cols-2 border border-border">
              {shown.map((asset, index) => (
                <div
                  key={`${asset.symbol}:${index}`}
                  className={cn(
                    'px-3 py-3',
                    index % 2 === 1 && 'border-l border-border',
                    index >= 2 && 'border-t border-border',
                  )}
                >
                  <p
                    className="text-4 tabular-nums"
                    style={{ fontFamily: 'var(--font-family-heading)' }}
                  >
                    {formatAmount(asset.value, lang)}
                  </p>
                  <p className="mt-1 text-1 uppercase tracking-[0.08em] text-neutral-11">
                    {tokenUnit(asset.symbol)}
                  </p>
                </div>
              ))}
            </div>
            {hidden > 0 ? (
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-1 text-1 uppercase tracking-[0.12em]"
                onClick={() => setExpanded(true)}
              >
                {t('showMoreCount', { count: hidden })}
                <ChevronDown className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-1 text-neutral-11">{t('noTreasuryLink')}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 py-4">
        <div className="bg-neutral-2 p-3">
          <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
            {t('seeks')}
          </p>
          <CapitalLine keys={seeks} />
        </div>
        <div className="bg-neutral-2 p-3">
          <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
            {t('offers')}
          </p>
          <CapitalLine keys={offers} />
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-border">
        <button
          type="button"
          disabled
          title={t('resourceLater')}
          aria-label={`${t('resource')}. ${t('resourceLater')}`}
          className="inline-flex h-11 items-center justify-center gap-2 border-r border-border bg-foreground px-3 text-1 uppercase tracking-[0.12em] text-background disabled:opacity-40"
        >
          {t('resource')}
          <ArrowUpRight className="size-3.5" aria-hidden />
        </button>
        <Link
          href={`/${lang}/dho/${space.slug}/overview`}
          className="inline-flex h-11 items-center justify-center gap-2 px-3 text-1 uppercase tracking-[0.12em]"
        >
          {t('visit')}
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {space.chatRoomId ? (
        <button
          type="button"
          className="border-t border-border px-3 py-3 text-1 uppercase tracking-[0.12em]"
          onClick={() => {
            openCoherenceChat(
              space.chatRoomId as string,
              space.title,
              '',
              space.description,
              space.slug,
            );
            openHumanChatPanel();
          }}
        >
          {t('connect')}
        </button>
      ) : null}
    </section>
  );
}

function overlapScore(left: NetworkRailSpace, right: NetworkRailSpace) {
  const seeks = new Set(parseCapitalKeys(left.seeks));
  const offers = new Set(parseCapitalKeys(left.offers));
  return (
    parseCapitalKeys(right.offers).filter((key) => seeks.has(key)).length +
    parseCapitalKeys(right.seeks).filter((key) => offers.has(key)).length
  );
}

function WeaveCard({
  lang,
  spaces,
  initialSlug,
}: {
  lang: Locale;
  spaces: NetworkRailSpace[];
  initialSlug: string;
}) {
  const t = useTranslations('NetworkExchange');
  const bySlug = (slug: string) => spaces.find((space) => space.slug === slug);
  const bestFor = (slug: string) =>
    spaces
      .filter((space) => space.slug !== slug)
      .map((space) => ({
        slug: space.slug,
        score: bySlug(slug)
          ? overlapScore(bySlug(slug) as NetworkRailSpace, space)
          : 0,
      }))
      .sort((left, right) => right.score - left.score)[0]?.slug ?? '';
  const [first, setFirst] = useState(
    bySlug(initialSlug)?.slug ?? spaces[0]?.slug ?? '',
  );
  const [second, setSecond] = useState(() => bestFor(first));
  const [firstGives, setFirstGives] = useState<CapitalKey[]>(
    parseCapitalKeys(bySlug(first)?.offers),
  );
  const [secondGives, setSecondGives] = useState<CapitalKey[]>(
    parseCapitalKeys(bySlug(second)?.offers),
  );
  const [more, setMore] = useState<{ slug: string; gives: CapitalKey[] }[]>([]);

  const chooseFirst = (slug: string) => {
    setFirst(slug);
    setFirstGives(parseCapitalKeys(bySlug(slug)?.offers));
    const next = bestFor(slug);
    if (next) {
      setSecond(next);
      setSecondGives(parseCapitalKeys(bySlug(next)?.offers));
    }
    setMore((current) => current.filter((party) => party.slug !== slug));
  };
  const chooseSecond = (slug: string) => {
    setSecond(slug);
    setSecondGives(parseCapitalKeys(bySlug(slug)?.offers));
    setMore((current) => current.filter((party) => party.slug !== slug));
  };

  useEffect(() => {
    if (!spaces.some((space) => space.slug === initialSlug)) return;
    chooseFirst(initialSlug);
  }, [initialSlug]);

  const pool = (exclude: string) => {
    const rows = [
      { slug: first, gives: firstGives },
      { slug: second, gives: secondGives },
      ...more,
    ];
    return rows
      .filter((row) => row.slug && row.slug !== exclude)
      .flatMap((row) => row.gives);
  };
  const parties = [
    bySlug(first),
    bySlug(second),
    ...more.map((row) => bySlug(row.slug)),
  ].filter((space): space is NetworkRailSpace => Boolean(space));
  const totalNeeds = parties.reduce(
    (sum, space) => sum + parseCapitalKeys(space.seeks).length,
    0,
  );
  const metNeeds = parties.reduce(
    (sum, space) =>
      sum +
      parseCapitalKeys(space.seeks).filter((key) =>
        pool(space.slug).includes(key),
      ).length,
    0,
  );
  const fit = totalNeeds ? Math.round((metNeeds / totalNeeds) * 100) : 0;
  const unmet = Array.from(
    new Set(
      parties.flatMap((space) =>
        parseCapitalKeys(space.seeks).filter(
          (key) => !pool(space.slug).includes(key),
        ),
      ),
    ),
  );
  const taken = new Set([first, second, ...more.map((row) => row.slug)]);
  const suggested = spaces
    .filter((space) => !taken.has(space.slug))
    .map((space) => ({
      space,
      matches: parseCapitalKeys(space.offers).filter((key) =>
        unmet.includes(key),
      ),
    }))
    .sort((left, right) => right.matches.length - left.matches.length)[0];
  const advice =
    suggested && suggested.matches.length > 0
      ? t('weaveAdviceAdd', {
          space: suggested.space.title,
          capitals: new Intl.ListFormat(lang, {
            style: 'long',
            type: 'conjunction',
          }).format(suggested.matches.map((key) => t(`capitals.${key}`))),
        })
      : fit === 100
      ? t('weaveAdviceFull')
      : t('weaveAdviceAdjust');
  const addable = spaces.filter((space) => !taken.has(space.slug));

  if (spaces.length < 2) {
    return (
      <Shell title={t('weaveTitle')} body={t('weaveBody')}>
        <p className="text-1 text-neutral-11">{t('noMatch')}</p>
      </Shell>
    );
  }

  const seeksOf = (space: NetworkRailSpace | undefined) => {
    if (!space) return null;
    const keys = parseCapitalKeys(space.seeks);
    return (
      <div>
        <p className="text-1 uppercase tracking-[0.12em]">{t('seeks')}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {keys.length === 0 ? (
            <span className="text-1 text-neutral-11">{t('noneYet')}</span>
          ) : (
            keys.map((key) => {
              const met = pool(space.slug).includes(key);
              return (
                <span
                  key={key}
                  className={cn(
                    'border px-2 py-0.5 text-1',
                    met
                      ? 'border-foreground'
                      : 'border-dashed border-border text-neutral-11',
                  )}
                >
                  {t(`capitals.${key}`)}
                </span>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <Shell title={t('weaveTitle')} body={t('weaveBody')}>
      <SpaceSelect spaces={spaces} value={first} onChange={chooseFirst} />
      {seeksOf(bySlug(first))}
      <div>
        <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
          {t('offers')}
        </p>
        <div className="mt-2">
          <CapitalChips value={firstGives} onChange={setFirstGives} />
        </div>
      </div>
      <SpaceSelect
        spaces={spaces}
        value={second}
        exclude={[first]}
        onChange={chooseSecond}
      />
      {seeksOf(bySlug(second))}
      <div>
        <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
          {t('offers')}
        </p>
        <div className="mt-2">
          <CapitalChips value={secondGives} onChange={setSecondGives} />
        </div>
      </div>
      {more.map((party) => (
        <div key={party.slug} className="grid gap-2 border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-2">{bySlug(party.slug)?.title}</p>
            <button
              type="button"
              className="text-1 uppercase tracking-[0.12em] text-neutral-11"
              onClick={() =>
                setMore((current) =>
                  current.filter((item) => item.slug !== party.slug),
                )
              }
            >
              {t('removeParty')}
            </button>
          </div>
          {seeksOf(bySlug(party.slug))}
          <CapitalChips
            value={party.gives}
            onChange={(gives) =>
              setMore((current) =>
                current.map((item) =>
                  item.slug === party.slug ? { ...item, gives } : item,
                ),
              )
            }
          />
        </div>
      ))}
      {addable.length > 0 ? (
        <select
          value=""
          onChange={(event) => {
            const space = bySlug(event.target.value);
            if (!space) return;
            setMore((current) => [
              ...current,
              { slug: space.slug, gives: parseCapitalKeys(space.offers) },
            ]);
          }}
          className="h-10 w-full border border-border bg-neutral-2 px-2 text-2 text-foreground"
        >
          <option value="">{t('addParty')}</option>
          {addable.map((space) => (
            <option key={space.slug} value={space.slug}>
              {space.title}
            </option>
          ))}
        </select>
      ) : null}
      <div className="border border-border bg-neutral-2 p-3">
        <p className="text-1 uppercase tracking-[0.12em]">
          {t('needsMet', { percent: fit })}
        </p>
        <p className="mt-2 text-1 leading-relaxed text-neutral-11">{advice}</p>
      </div>
      {/^[a-z0-9_-]{1,80}$/i.test(first) ? (
        <Button asChild className="w-full">
          <Link
            href={`/${lang}/dho/${first}/agreements/create/space-to-space-membership`}
          >
            {t('proposeAgreement')}
          </Link>
        </Button>
      ) : null}
    </Shell>
  );
}

function ShareCard({
  lang,
  kind,
}: {
  lang: Locale;
  kind: 'need' | 'signal' | 'story';
}) {
  const t = useTranslations('NetworkExchange');
  const title =
    kind === 'need'
      ? t('shareNeedTitle')
      : kind === 'story'
      ? t('shareStoryTitle')
      : t('shareSignalTitle');
  const body =
    kind === 'need'
      ? t('shareNeedBody')
      : kind === 'story'
      ? t('shareStoryBody')
      : t('shareSignalBody');

  return (
    <Shell title={title} body={body}>
      <Button asChild className="w-full">
        <Link href={`/${lang}/network/create`}>
          {kind === 'story' ? t('post') : t('share')}
        </Link>
      </Button>
    </Shell>
  );
}

function ActionShareCard({
  lang,
  preferredSlug,
  kind = 'signal',
}: {
  lang: Locale;
  preferredSlug: string;
  kind?: 'signal' | 'need';
}) {
  const t = useTranslations('NetworkExchange');
  const router = useRouter();
  const touched = useRef(false);
  const spaces = useMemberNamedSpaces();
  const [spaceSlug, setSpaceSlug] = useState('');
  const [signalType, setSignalType] = useState<NetworkFieldSignalKind>(
    kind === 'need' ? 'Need' : 'Opportunity',
  );
  const [text, setText] = useState('');
  const [amount, setAmount] = useState('');
  const isNeed = kind === 'need';

  useEffect(() => {
    if (touched.current) return;
    if (spaces.some((space) => space.slug === preferredSlug)) {
      setSpaceSlug(preferredSlug);
      return;
    }
    setSpaceSlug((current) => current || spaces[0]?.slug || '');
  }, [preferredSlug, spaces]);

  const share = () => {
    const title = text.trim();
    if (!spaceSlug || !/^[a-z0-9_-]{1,80}$/i.test(spaceSlug) || !title) return;
    const params = new URLSearchParams();
    params.set('type', isNeed ? 'Need' : signalType);
    params.set('sharedWithNetwork', '1');
    params.set('title', title.slice(0, 120));
    if (/^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0) {
      params.set('amount', amount);
    }
    router.push(
      `/${lang}/dho/${spaceSlug}/coherence/new-signal?${params.toString()}`,
    );
  };

  return (
    <section className="w-full space-y-3 border border-border bg-background p-4 text-2">
      <h2
        className="text-5"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {isNeed ? t('shareNeedTitle') : t('shareSignalTitle')}
      </h2>
      <p className="text-1 leading-relaxed text-neutral-11">
        {isNeed ? t('shareNeedBody') : t('shareSignalBody')}
      </p>
      <select
        value={spaceSlug}
        disabled={spaces.length === 0}
        onChange={(event) => {
          touched.current = true;
          setSpaceSlug(event.target.value);
        }}
        aria-label={t('chooseSpace')}
        className="h-11 w-full border border-border bg-neutral-2 px-3 text-2 font-semibold text-foreground disabled:opacity-50"
      >
        {spaces.length === 0 ? (
          <option value="">{t('noneYet')}</option>
        ) : (
          spaces.map((space) => (
            <option key={space.slug} value={space.slug}>
              {space.title}
            </option>
          ))
        )}
      </select>
      {!isNeed ? (
        <div>
          <p className="text-1 font-semibold">{t('signalType')}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {NETWORK_FIELD_KINDS.map((option) => {
              const on = signalType === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSignalType(option)}
                  className={cn(
                    'px-2 py-0.5 text-1',
                    on
                      ? 'bg-foreground text-background'
                      : 'bg-neutral-2 text-neutral-11',
                  )}
                >
                  {signalKindLabel(t, option)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <textarea
        value={text}
        maxLength={200}
        rows={3}
        placeholder={t('whatHappened')}
        aria-label={t('whatHappened')}
        onChange={(event) => setText(event.target.value)}
        className="w-full resize-none border border-border bg-neutral-2 p-3 text-2 outline-none"
      />
      <input
        value={amount}
        inputMode="decimal"
        maxLength={12}
        placeholder={t('linkedAmountHint')}
        aria-label={t('linkedAmountHint')}
        onChange={(event) => setAmount(event.target.value)}
        className="h-11 w-full border border-border bg-neutral-2 px-3 text-2 outline-none"
      />
      <button
        type="button"
        disabled={!spaceSlug || !text.trim()}
        onClick={share}
        className="w-full bg-foreground py-2.5 text-1 font-semibold uppercase tracking-[0.12em] text-background disabled:opacity-50"
      >
        {t('share')}
      </button>
    </section>
  );
}

function AllocatedCard({
  lang,
  payouts,
}: {
  lang: Locale;
  payouts: NetworkFieldPayout[];
}) {
  const t = useTranslations('NetworkExchange');
  return (
    <section className="w-full space-y-3 border border-border bg-background p-4 text-2">
      <h2
        className="text-5"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {t('allocatedTitle')}
      </h2>
      <p className="text-1 leading-relaxed text-neutral-11">
        {t('allocatedBody')}
      </p>
      <div className="space-y-2 border border-border bg-neutral-2 p-3">
        <p className="text-1 font-bold uppercase tracking-[0.14em] text-neutral-11">
          {t('allocatedToSignal')}
        </p>
        {payouts.length === 0 ? (
          <p className="text-1 text-neutral-11">{t('noTreasuryLink')}</p>
        ) : (
          payouts.map((payout, index) => (
            <p
              key={`${payout.token}:${payout.amount}:${index}`}
              className={cn('font-semibold', index === 0 ? 'text-7' : 'text-5')}
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {payoutFigures(payout.amount, lang)}{' '}
              <span className="text-2 font-medium text-neutral-11">
                {tokenUnit(payout.token)}
              </span>
            </p>
          ))
        )}
      </div>
    </section>
  );
}

function ImpactSharedCard({ count }: { count: number }) {
  const t = useTranslations('NetworkExchange');
  return (
    <Shell title={t('impactSharedTitle')} body={t('impactSharedBody')}>
      <p
        className="text-5"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {t('impactSharedCount', { count })}
      </p>
    </Shell>
  );
}

const NETWORK_RIGHT_PANEL_CLASS =
  'hidden w-full shrink-0 flex-col gap-4 overflow-y-auto @4xl:flex @4xl:w-[380px]';

export function NetworkRightColumn({
  lang,
  variant,
  spaces,
  selectedSlug,
  payouts = [],
  impactCount = 0,
  children,
}: {
  lang: Locale;
  variant: 'exchange' | 'needs' | 'action' | 'impact';
  spaces: NetworkRailSpace[];
  selectedSlug: string;
  payouts?: NetworkFieldPayout[];
  impactCount?: number;
  children?: ReactNode;
}) {
  const tExchange = useTranslations('NetworkExchange');
  const { open } = useHumanChatPanel();
  const selected = useMemo(
    () => spaces.find((space) => space.slug === selectedSlug) ?? spaces[0],
    [selectedSlug, spaces],
  );
  if (open) return null;
  if (variant === 'exchange' && !selected && !children) return null;
  const action = variant === 'action';
  return (
    <aside className={NETWORK_RIGHT_PANEL_CLASS}>
      {children ? (
        children
      ) : selected && !action && variant !== 'needs' ? (
        <SpaceCard lang={lang} space={selected} />
      ) : null}
      {!children && variant === 'exchange' && selected ? (
        <>
          <WeaveCard lang={lang} spaces={spaces} initialSlug={selected.slug} />
          <section className="border border-border p-4">
            <h3
              className="text-3"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {tExchange('shareProject')}
            </h3>
            <p className="mt-2 text-1 leading-relaxed text-neutral-11">
              {tExchange('shareProjectForm')}
            </p>
            <Link
              href={`/${lang}/network/create`}
              className="mt-3 inline-flex h-10 items-center border border-foreground bg-foreground px-3 text-1 uppercase tracking-[0.12em] text-background"
            >
              {tExchange('createSpace')}
            </Link>
          </section>
        </>
      ) : null}
      {!children && variant === 'needs' ? (
        <ActionShareCard
          lang={lang}
          preferredSlug={selected?.slug ?? selectedSlug}
          kind="need"
        />
      ) : null}
      {!children && action ? (
        <>
          <ActionShareCard
            lang={lang}
            preferredSlug={selected?.slug ?? selectedSlug}
          />
          <AllocatedCard lang={lang} payouts={payouts} />
        </>
      ) : null}
      {!children && variant === 'impact' ? (
        <>
          <ShareCard lang={lang} kind="story" />
          <ImpactSharedCard count={impactCount} />
        </>
      ) : null}
    </aside>
  );
}
