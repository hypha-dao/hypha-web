'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ChevronDown, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@hypha-platform/ui';
import { useAuthentication } from '@hypha-platform/authentication';
import type { Locale } from '@hypha-platform/i18n';
import {
  CAPITALS,
  DEFAULT_SPACE_LEAD_IMAGE,
  NETWORK_FIELD_KINDS,
  parseCapitalKeys,
  type CapitalKey,
  type NetworkFieldPayout,
  type NetworkFieldSignalKind,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { useHumanChatPanel } from '../common/human-chat-panel-context';

export type NetworkRailSpace = {
  slug: string;
  title: string;
  description: string;
  place: string;
  leadImage: string | null;
  chatRoomId: string | null;
  seeks: string[];
  offers: string[];
};

type TreasuryAsset = { symbol: string; value: number };

function excerpt(value: string | null | undefined) {
  const text = (value ?? '')
    .replace(/<[^>]+>/g, ' ')
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

function formatAmount(value: number, lang: string) {
  return new Intl.NumberFormat(lang, {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
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
          <span className="size-1.5 shrink-0 bg-foreground" aria-hidden />
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
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full border border-border bg-background px-2 text-2 text-foreground"
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
  const shown = expanded ? assets : assets.slice(0, 4);
  const hidden = Math.max(0, assets.length - shown.length);

  return (
    <section className="border border-border bg-background">
      <div className="relative h-40 overflow-hidden bg-neutral-3">
        <img
          src={leadImageSrc(space.leadImage)}
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-4 pb-4 text-white">
          <p className="text-1 uppercase tracking-[0.12em] text-white/80">
            {t('projectSpace')}
          </p>
          <h2
            className="mt-1 text-4 leading-tight"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {space.title}
          </h2>
          {space.place ? (
            <p className="mt-1 text-1 text-white/80">{space.place}</p>
          ) : null}
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
                    {asset.symbol}
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
          <p className="text-1 uppercase tracking-[0.12em]">{t('seeks')}</p>
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
        <Button
          type="button"
          disabled
          title={t('resourceLater')}
          aria-label={`${t('resource')}. ${t('resourceLater')}`}
          className="h-11"
        >
          {t('resource')}
        </Button>
        <Button
          asChild
          variant="outline"
          colorVariant="neutral"
          className="h-11 border-y-0 border-r-0"
        >
          <Link href={`/${lang}/dho/${space.slug}/overview`}>{t('visit')}</Link>
        </Button>
      </div>
      {space.chatRoomId ? (
        <button
          type="button"
          className="border-t border-border px-3 py-3 text-1 uppercase tracking-[0.12em]"
          onClick={() => {
            openCoherenceChat(
              space.chatRoomId as string,
              space.title,
              space.slug,
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
            const slug = event.target.value;
            const space = bySlug(slug);
            if (!space) return;
            setMore((current) => [
              ...current,
              { slug, gives: parseCapitalKeys(space.offers) },
            ]);
          }}
          className="h-10 w-full border border-border bg-background px-2 text-2 text-foreground"
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
      <Button asChild className="w-full">
        <Link
          href={`/${lang}/dho/${first}/agreements/create/space-to-space-membership`}
        >
          {t('proposeAgreement')}
        </Link>
      </Button>
    </Shell>
  );
}

function ShareCard({
  lang,
  spaces,
  initialSlug,
  kind,
}: {
  lang: Locale;
  spaces: NetworkRailSpace[];
  initialSlug: string;
  kind: 'need' | 'signal' | 'story';
}) {
  const t = useTranslations('NetworkExchange');
  const router = useRouter();
  const [slug, setSlug] = useState(
    spaces.find((space) => space.slug === initialSlug)?.slug ??
      spaces[0]?.slug ??
      '',
  );
  const [type, setType] = useState<NetworkFieldSignalKind>(
    kind === 'need' ? 'Need' : kind === 'story' ? 'Impact' : 'Action',
  );
  const [text, setText] = useState('');
  useEffect(() => {
    if (spaces.some((space) => space.slug === initialSlug))
      setSlug(initialSlug);
  }, [initialSlug, spaces]);

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

  const submit = () => {
    if (!slug || !text.trim()) return;
    const params = new URLSearchParams();
    params.set(
      'type',
      kind === 'need' ? 'Need' : kind === 'story' ? 'Impact' : type,
    );
    params.set('title', text.trim().slice(0, 120));
    router.push(
      `/${lang}/dho/${slug}/coherence/new-signal?${params.toString()}`,
    );
  };

  return (
    <Shell title={title} body={body}>
      {spaces.length === 0 ? (
        <p className="text-1 text-neutral-11">{t('noneYet')}</p>
      ) : (
        <SpaceSelect spaces={spaces} value={slug} onChange={setSlug} />
      )}
      {kind === 'signal' ? (
        <div className="flex flex-wrap gap-1">
          {NETWORK_FIELD_KINDS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              className={cn(
                'border px-2 py-1 text-1',
                type === option
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-neutral-11',
              )}
            >
              {t(
                option === 'Need'
                  ? 'filterNeed'
                  : option === 'Opportunity'
                  ? 'filterOpportunity'
                  : option === 'Risk'
                  ? 'filterRisk'
                  : option === 'Tension'
                  ? 'filterTension'
                  : option === 'Insight'
                  ? 'filterInsight'
                  : option === 'Action'
                  ? 'filterAction'
                  : 'filterImpact',
              )}
            </button>
          ))}
        </div>
      ) : null}
      <textarea
        value={text}
        maxLength={200}
        rows={3}
        placeholder={kind === 'story' ? t('storyTitle') : t('whatHappened')}
        onChange={(event) => setText(event.target.value)}
        className="w-full resize-none border border-border bg-background p-3 text-2 outline-none"
      />
      <Button
        type="button"
        className="w-full"
        disabled={!slug || !text.trim()}
        onClick={submit}
      >
        {kind === 'story' ? t('post') : t('share')}
      </Button>
    </Shell>
  );
}

function AllocatedCard({ payouts }: { payouts: NetworkFieldPayout[] }) {
  const t = useTranslations('NetworkExchange');
  return (
    <Shell title={t('allocatedTitle')} body={t('allocatedBody')}>
      {payouts.length === 0 ? (
        <p className="text-1 text-neutral-11">{t('noTreasuryLink')}</p>
      ) : (
        <div className="border border-border bg-neutral-2 p-3">
          <p className="text-1 uppercase tracking-[0.12em] text-neutral-11">
            {t('allocatedToSignal')}
          </p>
          <ul className="mt-2 grid gap-1">
            {payouts.map((payout) => (
              <li key={`${payout.token}:${payout.amount}`} className="text-3">
                {t('payoutLine', {
                  amount: payout.amount,
                  token: payout.token,
                })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Shell>
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

export function NetworkRightColumn({
  lang,
  variant,
  spaces,
  selectedSlug,
  payouts = [],
  impactCount = 0,
}: {
  lang: Locale;
  variant: 'exchange' | 'needs' | 'action' | 'impact';
  spaces: NetworkRailSpace[];
  selectedSlug: string;
  payouts?: NetworkFieldPayout[];
  impactCount?: number;
}) {
  const { open } = useHumanChatPanel();
  const selected = useMemo(
    () => spaces.find((space) => space.slug === selectedSlug) ?? spaces[0],
    [selectedSlug, spaces],
  );
  if (open || !selected) return null;
  return (
    <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[var(--menu-top-height)] lg:max-h-[calc(100dvh-var(--menu-top-height))] lg:overflow-y-auto">
      <SpaceCard lang={lang} space={selected} />
      {variant === 'exchange' ? (
        <WeaveCard lang={lang} spaces={spaces} initialSlug={selected.slug} />
      ) : null}
      {variant === 'needs' ? (
        <ShareCard
          lang={lang}
          spaces={spaces}
          initialSlug={selected.slug}
          kind="need"
        />
      ) : null}
      {variant === 'action' ? (
        <>
          <ShareCard
            lang={lang}
            spaces={spaces}
            initialSlug={selected.slug}
            kind="signal"
          />
          <AllocatedCard payouts={payouts} />
        </>
      ) : null}
      {variant === 'impact' ? (
        <>
          <ShareCard
            lang={lang}
            spaces={spaces}
            initialSlug={selected.slug}
            kind="story"
          />
          <ImpactSharedCard count={impactCount} />
        </>
      ) : null}
    </aside>
  );
}
