'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNowStrict } from 'date-fns';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@hypha-platform/i18n';
import {
  NETWORK_FIELD_KINDS,
  parseCapitalKeys,
  useJwt,
  type CapitalKey,
  type NetworkFieldSignalKind,
  type NetworkOpenNeed,
  type NetworkOpenNeedKind,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { useHumanChatPanel } from '../common/human-chat-panel-context';
import { resolveDateFnsLocale } from '../utils/date-fns-locale';
import { CAPITAL_MARK } from './capital-marks';

const FILTERS = ['all', 'Need', 'Risk', 'Tension'] as const;
type NeedFilter = (typeof FILTERS)[number];

type MemberSpace = { slug: string; title: string };

function capitalKey(value: string | null): CapitalKey | null {
  if (!value) return null;
  return parseCapitalKeys([value])[0] ?? null;
}

function kindLabel(
  kind: NetworkFieldSignalKind | NetworkOpenNeedKind,
  t: ReturnType<typeof useTranslations<'NetworkExchange'>>,
) {
  if (kind === 'Need') return t('filterNeed');
  if (kind === 'Opportunity') return t('filterOpportunity');
  if (kind === 'Risk') return t('filterRisk');
  if (kind === 'Tension') return t('filterTension');
  if (kind === 'Insight') return t('filterInsight');
  if (kind === 'Action') return t('filterAction');
  return t('filterImpact');
}

function badgeClass(type: NetworkOpenNeedKind) {
  if (type === 'Tension') return 'bg-warning-4 text-warning-12';
  if (type === 'Risk') return 'bg-error-3 text-error-12';
  return 'bg-foreground text-background';
}

function whenLabel(
  need: NetworkOpenNeed,
  t: ReturnType<typeof useTranslations<'NetworkExchange'>>,
  dateLocale: ReturnType<typeof resolveDateFnsLocale>,
) {
  if (need.type === 'Need' || !need.updatedAt) return t('ongoing');
  const date = new Date(need.updatedAt);
  if (Number.isNaN(date.getTime())) return t('ongoing');
  return formatDistanceToNowStrict(date, {
    addSuffix: true,
    locale: dateLocale,
  });
}

function NeedPhoto({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className="aspect-video w-full bg-neutral-3" />;
  }
  return (
    <img
      src={src}
      alt={alt}
      className="aspect-video w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function NeedsSharePanel({
  lang,
  preferredSlug,
}: {
  lang: Locale;
  preferredSlug: string | null;
}) {
  const t = useTranslations('NetworkExchange');
  const router = useRouter();
  const { jwt } = useJwt();
  const [spaces, setSpaces] = useState<MemberSpace[]>([]);
  const [spaceSlug, setSpaceSlug] = useState('');
  const [signalType, setSignalType] = useState<NetworkFieldSignalKind>('Need');
  const [signalText, setSignalText] = useState('');
  const [linkedAmount, setLinkedAmount] = useState('');

  useEffect(() => {
    if (!jwt) return;
    let cancelled = false;
    void (async () => {
      const me = await fetch('/api/v1/people/me', {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!me.ok) return;
      const person = (await me.json()) as { slug?: string };
      if (!person.slug) return;
      const list = await fetch(`/api/v1/people/${person.slug}/spaces`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!list.ok) return;
      const rows = (await list.json()) as { slug?: string; title?: string }[];
      if (cancelled || !Array.isArray(rows)) return;
      setSpaces(
        rows.flatMap((row) =>
          row.slug && row.title ? [{ slug: row.slug, title: row.title }] : [],
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [jwt]);

  useEffect(() => {
    setSpaceSlug((current) => {
      if (
        preferredSlug &&
        spaces.some((space) => space.slug === preferredSlug)
      ) {
        return preferredSlug;
      }
      if (current && spaces.some((space) => space.slug === current)) {
        return current;
      }
      return spaces[0]?.slug ?? '';
    });
  }, [preferredSlug, spaces]);

  const share = () => {
    const title = signalText.trim();
    if (!spaceSlug || !/^[a-z0-9_-]{1,80}$/i.test(spaceSlug) || !title) return;
    const params = new URLSearchParams();
    params.set('type', signalType);
    params.set('title', title.slice(0, 120));
    if (/^\d+(\.\d{1,2})?$/.test(linkedAmount) && Number(linkedAmount) > 0) {
      params.set('amount', linkedAmount);
    }
    router.push(
      `/${lang}/dho/${spaceSlug}/coherence/new-signal?${params.toString()}`,
    );
  };

  return (
    <section className="space-y-3 border border-border bg-background p-4 text-2">
      <h2
        className="text-5"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {t('shareNeedTitle')}
      </h2>
      <p className="text-1 text-neutral-11">{t('shareNeedBody')}</p>
      {spaces.length === 0 ? (
        <p className="text-1 text-neutral-11">{t('noneYet')}</p>
      ) : (
        <select
          value={spaceSlug}
          aria-label={t('chooseSpace')}
          onChange={(event) => setSpaceSlug(event.target.value)}
          className="h-11 w-full border border-border bg-neutral-2 px-3 text-2 font-semibold text-foreground"
        >
          {spaces.map((space) => (
            <option key={space.slug} value={space.slug}>
              {space.title}
            </option>
          ))}
        </select>
      )}
      <div>
        <p className="text-1 font-semibold">{t('signalType')}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {NETWORK_FIELD_KINDS.map((option) => {
            const selected = signalType === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => setSignalType(option)}
                className={cn(
                  'px-2 py-0.5 text-1',
                  selected
                    ? 'bg-foreground text-background'
                    : 'bg-neutral-2 text-neutral-11',
                )}
              >
                {kindLabel(option, t)}
              </button>
            );
          })}
        </div>
      </div>
      <textarea
        value={signalText}
        maxLength={200}
        rows={3}
        placeholder={t('whatHappened')}
        aria-label={t('whatHappened')}
        onChange={(event) => setSignalText(event.target.value)}
        className="w-full resize-none border border-border bg-neutral-2 p-3 text-2 outline-none"
      />
      <input
        value={linkedAmount}
        inputMode="decimal"
        maxLength={12}
        placeholder={t('linkedAmountHint')}
        aria-label={t('linkedAmountHint')}
        onChange={(event) => setLinkedAmount(event.target.value)}
        className="h-11 w-full border border-border bg-neutral-2 px-3 text-2 outline-none"
      />
      <button
        type="button"
        disabled={!spaceSlug || !signalText.trim()}
        onClick={share}
        className="w-full bg-foreground py-2.5 text-1 font-semibold uppercase tracking-[0.12em] text-background disabled:opacity-50"
      >
        {t('share')}
      </button>
    </section>
  );
}

export function NetworkNeedsBoard({
  lang,
  needs,
  empty,
}: {
  lang: Locale;
  needs: NetworkOpenNeed[];
  empty: string;
}) {
  const t = useTranslations('NetworkExchange');
  const dateLocale = resolveDateFnsLocale(useLocale());
  const { open, openCoherenceChat, openHumanChatPanel } = useHumanChatPanel();
  const [filter, setFilter] = useState<NeedFilter>('all');
  const [selectedSlug, setSelectedSlug] = useState(needs[0]?.slug ?? '');
  const visible = useMemo(
    () =>
      filter === 'all' ? needs : needs.filter((need) => need.type === filter),
    [filter, needs],
  );
  const selected =
    visible.find((need) => need.slug === selectedSlug) ??
    visible[0] ??
    needs[0];
  const spaceCount = useMemo(
    () => new Set(needs.map((need) => need.spaceSlug)).size,
    [needs],
  );

  const openRoom = (need: NetworkOpenNeed) => {
    if (!need.spaceChatRoomId) return;
    openCoherenceChat(
      need.spaceChatRoomId,
      need.spaceTitle,
      need.slug,
      need.description,
      need.spaceSlug,
    );
    openHumanChatPanel();
  };

  return (
    <div className="flex min-w-0 flex-col items-start gap-4 lg:flex-row">
      <div className="@container flex min-w-0 flex-1 flex-col gap-4">
        <header>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-11">
            {t('readFromSignals')}
          </p>
          <h1
            className="text-7 leading-tight sm:text-8"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {t('needsTitle')}
          </h1>
        </header>
        {needs.length > 0 ? (
          <p className="text-1 text-neutral-11">
            {t('needsSummary', { needs: needs.length, spaces: spaceCount })}
          </p>
        ) : (
          <p className="text-1 text-neutral-11">{empty}</p>
        )}
        {needs.length > 0 ? (
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label={t('needsTitle')}
          >
            {FILTERS.map((option) => {
              const selectedFilter = filter === option;
              const label =
                option === 'all' ? t('filterAll') : kindLabel(option, t);
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selectedFilter}
                  onClick={() => setFilter(option)}
                  className={cn(
                    'px-3 py-1 text-1',
                    selectedFilter
                      ? 'bg-foreground text-background'
                      : 'bg-neutral-2 text-neutral-11',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}
        {needs.length > 0 && visible.length === 0 ? (
          <p className="text-1 text-neutral-11">{t('needsFilterEmpty')}</p>
        ) : null}
        {visible.length > 0 ? (
          <ul className="grid content-start grid-cols-1 gap-4 @3xl:grid-cols-2 @6xl:grid-cols-3">
            {visible.map((need) => {
              const capital = capitalKey(need.capital);
              const when = whenLabel(need, t, dateLocale);
              const selectedCard = need.slug === selected?.slug;
              return (
                <li key={need.slug} className="flex">
                  <article
                    className={cn(
                      'flex w-full flex-col border bg-background',
                      selectedCard ? 'border-foreground' : 'border-border',
                    )}
                    onClick={() => setSelectedSlug(need.slug)}
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                      <span
                        className={cn(
                          'px-2 py-0.5 text-[10px]',
                          badgeClass(need.type),
                        )}
                      >
                        {kindLabel(need.type, t)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-1 text-neutral-11">
                        {capital ? (
                          <span aria-hidden>{CAPITAL_MARK[capital]}</span>
                        ) : null}
                        {capital
                          ? t('capitalStatus', {
                              capital: t(`capitals.${capital}`),
                              status: when,
                            })
                          : when}
                      </span>
                    </div>
                    <div className="border-b border-border">
                      <NeedPhoto src={need.leadImage} alt={need.title} />
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <h2 className="text-3 leading-snug">{need.title}</h2>
                      <p className="text-1 uppercase text-neutral-11">
                        {need.spaceTitle}
                      </p>
                      <div className="flex gap-3 text-1">
                        <Link
                          href={`/${lang}/network/proof-of-action`}
                          className="underline-offset-2 hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {t('proofsOfAction', { count: need.actionCount })}
                        </Link>
                        <Link
                          href={`/${lang}/network/proof-of-impact`}
                          className="underline-offset-2 hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {t('proofsOfImpact', { count: need.impactCount })}
                        </Link>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 border-t border-border">
                      <button
                        type="button"
                        disabled
                        title={t('resourceLater')}
                        aria-label={`${t('resource')}. ${t('resourceLater')}`}
                        className="h-10 bg-foreground text-1 font-semibold uppercase tracking-[0.12em] text-background disabled:opacity-40"
                      >
                        {t('resource')}
                      </button>
                      <button
                        type="button"
                        disabled={!need.spaceChatRoomId}
                        title={need.spaceChatRoomId ? undefined : t('noRoom')}
                        onClick={(event) => {
                          event.stopPropagation();
                          openRoom(need);
                        }}
                        className="h-10 text-1 font-semibold uppercase tracking-[0.12em] hover:bg-neutral-2 disabled:opacity-40"
                      >
                        {t('connect')}
                      </button>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      <aside
        className={cn(
          'w-full shrink-0 lg:sticky lg:top-[var(--menu-top-height)] lg:max-h-[calc(100dvh-var(--menu-top-height))] lg:w-[380px] lg:overflow-y-auto',
          open && 'hidden',
        )}
      >
        <NeedsSharePanel
          lang={lang}
          preferredSlug={selected?.spaceSlug ?? null}
        />
      </aside>
    </div>
  );
}
