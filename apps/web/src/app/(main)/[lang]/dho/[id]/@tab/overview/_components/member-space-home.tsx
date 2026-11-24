'use client';

import { useMemo, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  DEFAULT_SPACE_LEAD_IMAGE,
  useSpaceBySlug,
  type CoherenceUpvoteSummary,
} from '@hypha-platform/core/client';
import {
  ActionGate,
  AiLeftPanel,
  SignalUpvoteButton,
  signalDetailPath,
  signalVotingSpaceId,
  useSignalSpaceMembership,
  useSignalVotingMode,
} from '@hypha-platform/epics';
import { MEMBER_SCREEN_STACK } from '../../../../../_components/member-page-shell';
import { SidebarProvider } from '@hypha-platform/ui';
import { cn, stripDescription } from '@hypha-platform/ui-utils';
import type { Locale } from '@hypha-platform/i18n';

type HomeSignal = {
  id: number;
  title: string;
  description: string;
  slug: string | null;
  type: string;
  leadImage: string | null;
  archived?: boolean;
  upvotes?: CoherenceUpvoteSummary;
};

function plainText(value: string) {
  return stripDescription(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function signalKind(type: string) {
  const text = type.replace(/[_-]+/g, ' ').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Home signal strip — compact vs energy-community’s ~2.2-wide cards.
 * ~3.2 across on desktop (16px gaps), ~70% on phone, hard max so photos stay short.
 */
const HOME_CARD_WIDTH =
  'w-[min(17.5rem,calc((100%-32px)/3.2))] max-md:w-[70%] min-w-[10.5rem]';
/** Fixed photo height so width changes don’t puff the strip. */
const HOME_CARD_IMAGE = 'mb-2 h-[7.5rem] w-full object-cover';

/** Theme `size-9` is 64px — arrows must stay 36px like the reference. */
const HOME_ARROW_CLASS =
  'box-border grid h-[36px] w-[36px] min-h-[36px] min-w-[36px] shrink-0 place-items-center border border-border bg-transparent p-0 text-foreground transition-colors hover:bg-foreground/5';

function safeImage(url: string | null) {
  if (!url) return null;
  if (
    url.startsWith('https://') ||
    url.startsWith('http://') ||
    url.startsWith('/')
  ) {
    return url;
  }
  return null;
}

export function MemberSpaceHome({ spaceSlug }: { spaceSlug: string }) {
  const t = useTranslations('MemberMenu');
  const signalTypes = useTranslations('CoherenceTab');
  const params = useParams<{ lang?: string }>();
  const lang = (typeof params.lang === 'string' ? params.lang : 'en') as Locale;
  const stripRef = useRef<HTMLDivElement>(null);
  const { getAccessToken, isLoading: authLoading } = useAuthentication();
  const { space, isLoading: spaceLoading } = useSpaceBySlug(spaceSlug);
  const spaceTitle = space?.title?.trim() || t('yourSpace');
  const spaceHeader =
    safeImage(space?.leadImage ?? null) ??
    (spaceLoading ? null : DEFAULT_SPACE_LEAD_IMAGE);
  const {
    votingMode,
    status: votingModeStatus,
    retry: retryVotingMode,
  } = useSignalVotingMode(signalVotingSpaceId(space));
  const { isNonMember, isMembershipPending } = useSignalSpaceMembership(space);
  const endpoint = authLoading
    ? null
    : `/api/v1/spaces/${encodeURIComponent(
        spaceSlug,
      )}/coherences?pageSize=12&orderBy=mostrecent`;
  const { data, error, isLoading, mutate } = useSWR<{ data?: HomeSignal[] }>(
    endpoint,
    async (url: string) => {
      const headers: HeadersInit = { Accept: 'application/json' };
      const token = await getAccessToken().catch(() => null);
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Failed to load signals: ${response.status}`);
      }
      return (await response.json()) as { data?: HomeSignal[] };
    },
  );
  const signals = useMemo(
    () => (data?.data ?? []).filter((signal) => signal.title?.trim()),
    [data],
  );

  const scrollStrip = (direction: -1 | 1) => {
    const strip = stripRef.current;
    if (!strip) return;
    const card = strip.querySelector('article');
    const styles = window.getComputedStyle(strip);
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0;
    const distance = card
      ? card.getBoundingClientRect().width + gap
      : strip.clientWidth * 0.9;
    strip.scrollBy({
      left: direction * distance,
      behavior: 'smooth',
    });
  };

  return (
    <div className={MEMBER_SCREEN_STACK} data-member-home="">
      <section
        className="flex min-w-0 flex-col"
        aria-labelledby="member-space-home-title"
        data-member-home-news=""
      >
        {/* Eyebrow row — space left, section right (energy-community). */}
        <div className="flex items-center justify-between gap-4">
          <p className="m-0 text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
            {spaceTitle}
          </p>
          <p className="m-0 text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
            {t('communitySignals')}
          </p>
        </div>

        {/* Title + 36px arrows on one row (lovable compact 32px). */}
        <div className="mt-2.5 mb-[18px] flex items-center justify-between gap-4">
          <h1
            id="member-space-home-title"
            className="craft-page-title m-0 text-[28px] font-light leading-[1.15] tracking-normal text-foreground sm:text-[32px]"
          >
            {t('around')}
          </h1>
          <div className="hidden shrink-0 items-center gap-1.5 md:flex">
            <button
              type="button"
              className={HOME_ARROW_CLASS}
              aria-label={t('previousSignals')}
              onClick={() => scrollStrip(-1)}
            >
              <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden />
            </button>
            <button
              type="button"
              className={HOME_ARROW_CLASS}
              aria-label={t('nextSignals')}
              onClick={() => scrollStrip(1)}
            >
              <ChevronRight className="size-4" strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        </div>

        {authLoading || isLoading || (!data && !error) ? (
          <div
            className="flex snap-x items-stretch gap-4 overflow-hidden"
            aria-hidden
          >
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className={cn(
                  `flex min-w-0 ${HOME_CARD_WIDTH} shrink-0 flex-col border border-border p-2.5`,
                  index === 1 && 'hidden md:flex',
                  index === 2 && 'hidden lg:flex',
                )}
              >
                <div className={cn(HOME_CARD_IMAGE, 'bg-accent-3')} />
                <div className="mt-2 flex flex-1 flex-col gap-1.5">
                  <div className="h-2.5 w-14 bg-accent-3/60" />
                  <div className="h-4 w-4/5 bg-accent-3/60" />
                  <div className="h-2.5 w-full bg-accent-3/50" />
                  <div className="h-2.5 w-5/6 bg-accent-3/50" />
                  <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
                    <div className="h-[36px] w-20 bg-accent-3/60" />
                    <div className="h-[34px] w-14 bg-accent-3/60" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-3">
            <p className="text-2 text-muted-foreground">{t('signalsFailed')}</p>
            <button
              type="button"
              className="inline-flex h-8 items-center border border-border px-3 text-1 text-foreground hover:bg-foreground/5"
              onClick={() => void mutate()}
            >
              {t('retry')}
            </button>
          </div>
        ) : signals.length === 0 ? (
          <p className="max-w-md text-2 text-muted-foreground">
            {t('noSignals')}
          </p>
        ) : (
          <div
            ref={stripRef}
            className="flex snap-x items-stretch gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {signals.map((signal) => {
              const image = safeImage(signal.leadImage) ?? spaceHeader;
              const href = signal.slug
                ? `${signalDetailPath(
                    lang,
                    spaceSlug,
                    signal.slug,
                  )}?discussion=open`
                : `/${lang}/dho/${spaceSlug}/coherence`;
              const typeKey = `types.${signal.type.trim()}`;
              const typeLabel =
                signal.type.trim() && signalTypes.has(typeKey as never)
                  ? signalTypes(typeKey as never)
                  : signalKind(signal.type);
              return (
                <article
                  key={signal.id}
                  className={cn(
                    `flex min-w-0 ${HOME_CARD_WIDTH} shrink-0 snap-start cursor-pointer flex-col border border-border bg-transparent p-2.5`,
                  )}
                >
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" className={HOME_CARD_IMAGE} />
                  ) : (
                    <div className={cn(HOME_CARD_IMAGE, 'bg-accent-3')} />
                  )}
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <p className="m-0 text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                      {typeLabel}
                    </p>
                    <h2
                      className="mt-1.5 m-0 min-w-0 break-words text-[17px] font-light leading-[1.2] text-foreground"
                      style={{ fontFamily: 'var(--font-family-heading)' }}
                    >
                      {signal.title}
                    </h2>
                    <p className="mt-1.5 mb-2 line-clamp-2 min-w-0 text-[12px] leading-[1.45] text-muted-foreground">
                      {plainText(signal.description)}
                    </p>
                    <div className="mt-auto flex w-full min-w-0 flex-nowrap items-center gap-2 border-t border-border pt-3">
                      <div className="min-w-0 shrink-0">
                        <ActionGate kind="upvote" fullAppPath="" label={null}>
                          <SignalUpvoteButton
                            slug={signal.slug}
                            spaceSlug={spaceSlug}
                            upvotes={signal.upvotes}
                            votingMode={votingMode}
                            votingModeStatus={votingModeStatus}
                            onRetryVotingMode={retryVotingMode}
                            isNonMember={isNonMember}
                            isMembershipPending={isMembershipPending}
                            refresh={() => mutate()}
                            archived={signal.archived}
                            summaryState="ready"
                            className="h-[36px] [&_[data-testid='signal-upvote-cell']]:h-[36px]"
                          />
                        </ActionGate>
                      </div>
                      <Link
                        href={href}
                        className="inline-flex h-[34px] min-h-[34px] shrink-0 items-center gap-1.5 border border-border bg-transparent px-3 text-[12px] text-foreground hover:bg-foreground/5"
                      >
                        {t('open')}
                        <ChevronRight
                          className="size-3.5"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section aria-label={t('askThisSpace')} className="mt-2 min-w-0 sm:mt-4">
        <SidebarProvider
          open
          className="h-auto min-h-[28rem] border border-border"
        >
          <AiLeftPanel embed="page" />
        </SidebarProvider>
      </section>
    </div>
  );
}
