'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  useSpaceBySlug,
  type CoherenceUpvoteSummary,
} from '@hypha-platform/core/client';
import {
  ActionGate,
  AiLeftPanel,
  MySpacesSwitcherMenu,
  SignalUpvoteButton,
  signalDetailPath,
  signalVotingSpaceId,
  useSignalSpaceMembership,
  useSignalVotingMode,
} from '@hypha-platform/epics';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  SidebarProvider,
} from '@hypha-platform/ui';
import { stripDescription } from '@hypha-platform/ui-utils';
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

function MemberHomeSpaceSwitcher({ title }: { title: string }) {
  const tNavigation = useTranslations('Navigation');
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex min-w-0 max-w-full items-center gap-1 text-[11px] tracking-[0.14em] text-muted-foreground uppercase"
          aria-label={tNavigation('mySpaces')}
        >
          <span className="min-w-0 truncate">{title}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="z-[70] w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden p-0"
      >
        <div className="h-72">
          <MySpacesSwitcherMenu open={open} onSelect={() => setOpen(false)} />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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

/** Two cards, with the next one peeking. Wide enough for the photo on top. */
const HOME_CARD_WIDTH =
  'w-[calc(100%-3.25rem)] md:w-[min(32rem,calc((100%-1.25rem)/2.15))]';

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
  const { space } = useSpaceBySlug(spaceSlug);
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
      : strip.clientWidth * 0.85;
    strip.scrollBy({
      left: direction * distance,
      behavior: 'smooth',
    });
  };

  return (
    <div className="flex flex-col gap-10 px-4 py-2 sm:px-5">
      <section aria-labelledby="member-space-home-title">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            {space?.title ? (
              <MemberHomeSpaceSwitcher title={space.title} />
            ) : null}
            <h1
              id="member-space-home-title"
              className="text-7 text-foreground sm:text-8"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {t('around')}
            </h1>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
              {t('communitySignals')}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="grid h-8 w-8 place-items-center border border-border text-muted-foreground hover:text-foreground"
                aria-label={t('previousSignals')}
                onClick={() => scrollStrip(-1)}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                className="grid h-8 w-8 place-items-center border border-border text-muted-foreground hover:text-foreground"
                aria-label={t('nextSignals')}
                onClick={() => scrollStrip(1)}
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
        {authLoading || isLoading || (!data && !error) ? (
          <div
            className="mt-6 flex items-stretch gap-4 overflow-hidden"
            aria-hidden
          >
            <div className={`${HOME_CARD_WIDTH} shrink-0`}>
              <div className="aspect-[3/2] bg-accent-3" />
              <div className="h-40 bg-accent-3/50" />
            </div>
            <div className={`${HOME_CARD_WIDTH} hidden shrink-0 md:block`}>
              <div className="aspect-[3/2] bg-accent-3" />
              <div className="h-40 bg-accent-3/50" />
            </div>
          </div>
        ) : error ? (
          <div className="mt-6 flex items-center gap-3">
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
          <p className="mt-6 max-w-md text-2 text-muted-foreground">
            {t('noSignals')}
          </p>
        ) : (
          <div
            ref={stripRef}
            className="mt-6 flex snap-x items-stretch gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {signals.map((signal) => {
              const image = safeImage(signal.leadImage);
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
                  className={`flex ${HOME_CARD_WIDTH} shrink-0 snap-start flex-col border border-border bg-background`}
                >
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt=""
                      className="aspect-[3/2] w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-[3/2] w-full bg-accent-3" />
                  )}
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                      {typeLabel}
                    </p>
                    <h2
                      className="text-5 text-foreground sm:text-6"
                      style={{ fontFamily: 'var(--font-family-heading)' }}
                    >
                      {signal.title}
                    </h2>
                    <p className="line-clamp-3 text-2 text-muted-foreground">
                      {plainText(signal.description)}
                    </p>
                    <div className="mt-auto flex items-center gap-3 border-t border-border pt-3">
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
                        />
                      </ActionGate>
                      <Link
                        href={href}
                        className="inline-flex h-7 items-center gap-1 border border-border px-3 text-1 text-foreground hover:bg-foreground/5"
                      >
                        {t('open')}
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <section aria-label={t('askThisSpace')} className="min-w-0">
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
