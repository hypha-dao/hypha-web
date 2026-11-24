'use client';

import { useMemo, useRef } from 'react';
import useSWR from 'swr';
import { ChevronLeft, ChevronRight, Radio, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  DEFAULT_SPACE_LEAD_IMAGE,
  mergePendingSignalUpvotes,
  useMe,
  useSpaceBySlug,
  type Coherence,
  type CoherenceUpvoteSummary,
} from '@hypha-platform/core/client';
import {
  ActionGate,
  AiLeftPanel,
  MEMBER_BODY,
  MEMBER_EYEBROW,
  MEMBER_PAGE_TITLE,
  MEMBER_ROW_TITLE,
  MemberEyebrow,
  SignalUpvoteButton,
  signalVotingSpaceId,
  spaceAskShortName,
  useHumanChatPanel,
  useSignalSpaceMembership,
  useSignalVotingMode,
} from '@hypha-platform/epics';
import { MEMBER_SCREEN_STACK } from '../../../../../_components/member-page-shell';
import { SidebarProvider } from '@hypha-platform/ui';
import { cn, stripDescription } from '@hypha-platform/ui-utils';

type HomeSignal = {
  id: number;
  title: string;
  description: string;
  slug: string | null;
  type: string;
  leadImage: string | null;
  roomId?: string | null;
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
 * Home signal strip — match image 1 (energy-community / Rue Verte mock).
 * ~2.2 cards across on desktop, near-square card, 16:9 lead image.
 */
const HOME_CARD_WIDTH =
  'w-[min(22rem,calc((100%-2rem)/2.2))] max-md:w-[78%] min-w-[14rem]';
/** Lead image keeps 16:9 as the card width changes. */
const HOME_CARD_IMAGE = 'mb-2.5 aspect-[16/9] w-full object-cover';

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
  const stripRef = useRef<HTMLDivElement>(null);
  const { getAccessToken, isLoading: authLoading } = useAuthentication();
  const { person } = useMe();
  const viewerKey = person?.slug?.trim() || person?.address?.trim() || 'anon';
  const { open, mode, coherenceSlug, coherenceChannel, openCoherenceChat } =
    useHumanChatPanel();
  const { space, isLoading: spaceLoading } = useSpaceBySlug(spaceSlug);
  const activeSignalSlug =
    open &&
    mode === 'coherence' &&
    (!coherenceChannel || coherenceChannel === 'signal')
      ? coherenceSlug?.trim() || null
      : null;
  const spaceTitle = space?.title?.trim() || t('yourSpace');
  const askName = spaceAskShortName(spaceTitle) || t('yourSpace');
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
    endpoint ? [endpoint, viewerKey] : null,
    async ([url]: [string, string]) => {
      const headers: HeadersInit = { Accept: 'application/json' };
      const token = await getAccessToken().catch(() => null);
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Failed to load signals: ${response.status}`);
      }
      const json = (await response.json()) as { data?: HomeSignal[] };
      const merged = mergePendingSignalUpvotes(
        spaceSlug,
        (json.data ?? []) as Coherence[],
        { fromFetch: true },
      ) as HomeSignal[];
      return { ...json, data: merged };
    },
  );
  const signals = useMemo(() => {
    const items = (data?.data ?? []).filter((signal) => signal.title?.trim());
    return mergePendingSignalUpvotes(
      spaceSlug,
      items as Coherence[],
    ) as HomeSignal[];
  }, [data, spaceSlug]);

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
          <MemberEyebrow>{spaceTitle}</MemberEyebrow>
          <MemberEyebrow icon={Radio}>{t('communitySignals')}</MemberEyebrow>
        </div>

        {/* Title + 36px arrows on one row (lovable compact 32px). */}
        <div className="mt-2.5 mb-[18px] flex items-center justify-between gap-4">
          <h1 id="member-space-home-title" className={MEMBER_PAGE_TITLE}>
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
                  `flex min-w-0 ${HOME_CARD_WIDTH} shrink-0 flex-col border border-border p-3`,
                  index === 1 && 'hidden md:flex',
                  index === 2 && 'hidden lg:flex',
                )}
              >
                <div className={cn(HOME_CARD_IMAGE, 'bg-accent-3')} />
                <div className="mt-1 flex flex-1 flex-col gap-1.5">
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
              const typeKey = `types.${signal.type.trim()}`;
              const typeLabel =
                signal.type.trim() && signalTypes.has(typeKey as never)
                  ? signalTypes(typeKey as never)
                  : signalKind(signal.type);
              const slug = signal.slug?.trim() || '';
              const selected = Boolean(slug) && activeSignalSlug === slug;
              const openSignalChat = () => {
                if (!slug) return;
                openCoherenceChat(
                  signal.roomId?.trim() || null,
                  signal.title,
                  slug,
                  signal.description ?? null,
                  spaceSlug,
                  {
                    channel: 'signal',
                    signalLeadImage: safeImage(signal.leadImage),
                    signalTypeLabel: typeLabel || null,
                  },
                );
              };
              return (
                <article
                  key={signal.id}
                  className={cn(
                    `relative flex min-w-0 ${HOME_CARD_WIDTH} shrink-0 snap-start flex-col border bg-transparent p-3 transition-colors`,
                    selected
                      ? 'border-foreground ring-1 ring-foreground'
                      : 'border-border hover:bg-foreground/[0.02]',
                  )}
                >
                  <button
                    type="button"
                    className="absolute inset-0 z-0"
                    aria-label={signal.title}
                    aria-pressed={selected}
                    onClick={openSignalChat}
                    disabled={!slug}
                  />
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt=""
                      className={cn(HOME_CARD_IMAGE, 'pointer-events-none')}
                    />
                  ) : (
                    <div
                      className={cn(
                        HOME_CARD_IMAGE,
                        'pointer-events-none bg-accent-3',
                      )}
                    />
                  )}
                  <div className="pointer-events-none relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col">
                    <p className={cn(MEMBER_EYEBROW, 'text-[10px]')}>
                      {typeLabel}
                    </p>
                    <h2
                      className={cn(
                        MEMBER_ROW_TITLE,
                        'mt-1.5 line-clamp-2 min-w-0 break-words',
                      )}
                    >
                      {signal.title}
                    </h2>
                    <p
                      className={cn(
                        MEMBER_BODY,
                        'mt-1.5 mb-3 line-clamp-2 min-w-0 text-[12px] leading-[1.45]',
                      )}
                    >
                      {plainText(signal.description)}
                    </p>
                    <div className="pointer-events-auto mt-auto flex w-full min-w-0 flex-nowrap items-center gap-2 border-t border-border pt-3">
                      <div
                        className="min-w-0 shrink-0"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
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
                      <button
                        type="button"
                        className="inline-flex h-[34px] min-h-[34px] shrink-0 items-center gap-1.5 border border-border bg-transparent px-3 text-[12px] text-foreground hover:bg-foreground/5 disabled:opacity-50"
                        onClick={openSignalChat}
                        disabled={!slug}
                      >
                        {t('open')}
                        <ChevronRight
                          className="size-3.5"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section
        aria-label={t('askSpace', { name: askName })}
        className="mx-auto mt-2 w-full min-w-0 max-w-[40rem] sm:mt-4"
        data-member-home-ask=""
      >
        <div className="mb-4 border-b border-border pb-4">
          <MemberEyebrow icon={Sparkles}>
            {t('askSpaceEyebrow', { name: askName })}
          </MemberEyebrow>
          <h2
            id="member-space-home-ask-title"
            className={cn(MEMBER_PAGE_TITLE, 'mt-2.5')}
          >
            {t('askSpace', { name: askName })}
          </h2>
        </div>
        <SidebarProvider open className="h-auto min-h-[24rem]">
          <AiLeftPanel embed="page" />
        </SidebarProvider>
      </section>
    </div>
  );
}
