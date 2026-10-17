'use client';

import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Radio, Scale } from 'lucide-react';
import { Locale } from '@hypha-platform/i18n';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import {
  listMemberHomeAttentionItems,
  listMemberHomeThreadItems,
  memberHomeItemsStillWaiting,
  mergeMemberHomeAttention,
  type MemberHomeThreadItem,
  type MemberIntelligence,
} from '@hypha-platform/core/client';

import {
  getOnboardingPath,
  getProposalPath,
  getSignalPath,
} from '../../common/get-path-function';
import type { SignupOrientation } from './signup-flow';
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';

import { HOME_CHAT_COLUMN, MemberHomeChat } from './member-home-chat';
import {
  HOME_QUEUE_EVENT,
  bindHomePerson,
  readHomeActed,
  readHomeChoices,
} from './member-home-resume';

export { HOME_REFRESH_EVENT } from './member-home-resume';
import { MemberHomeThreadCard } from './member-home-thread-card';
import { MemberHomeMark } from './member-home-mark';
import { PersonRoleBadge } from './person-badges';
import { MemberHomeInviteBanners } from './member-home-invite-banner';
import { MemberHomeClosest } from './member-home-closest';
import {
  MemberHomePeople,
  type MemberHomeOpenChat,
} from './member-home-people';
import {
  MemberHomeConnectionsWidget,
  MemberHomeWalletWidget,
} from './member-home-side-widgets';
import { MemberHomeSpacesRail } from './member-home-spaces-rail';
import { MemberHomeEnergyPanel } from './member-home-energy-panel';
import {
  HOME_VIEW_EVENT,
  readHomeView,
  writeHomeView,
  type HomeView,
} from './member-home-view';
import './member-home-banner.css';

type MemberHomeProps = {
  lang: Locale;
  intelligence?: MemberIntelligence | null;
  isLoading?: boolean;
  greetingName?: string | null;
  isSavingOrientation?: boolean;
  orientationError?: string | null;
  onChooseOrientation: (orientation: SignupOrientation) => void;
};

const ORIENTATIONS: SignupOrientation[] = ['member', 'builder', 'investor'];
function orientationLabelKey(orientation: SignupOrientation) {
  if (orientation === 'member') return 'orientationMember' as const;
  if (orientation === 'builder') return 'orientationBuilder' as const;
  return 'orientationInvestor' as const;
}

function greetingKey(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'greetingMorning' as const;
  if (hour < 18) return 'greetingAfternoon' as const;
  return 'greetingEvening' as const;
}

function isSignupOrientation(
  value: string | null | undefined,
): value is SignupOrientation {
  return value === 'member' || value === 'builder' || value === 'investor';
}

type HomeQueueMemory = {
  passed: string[];
  deferred: string[];
  settled: string[];
  recalled: string[];
};

type HomeQueueSnapshot = {
  passed: string[];
  deferred: string[];
  settled: string[];
  acted: string[];
};

const EMPTY_HOME_QUEUE_SNAPSHOT = JSON.stringify({
  passed: [],
  deferred: [],
  settled: [],
  acted: [],
} satisfies HomeQueueSnapshot);

function subscribeHomeQueue(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(HOME_QUEUE_EVENT, onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    window.removeEventListener(HOME_QUEUE_EVENT, onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

function readHomeQueueSnapshot() {
  const choices = readHomeChoices();
  return JSON.stringify({
    passed: choices.passed,
    deferred: choices.deferred,
    settled: choices.settled,
    acted: readHomeActed(),
  } satisfies HomeQueueSnapshot);
}

function sameHomeQueueMemory(
  current: HomeQueueMemory | null,
  next: HomeQueueMemory,
) {
  if (!current) return false;
  const list = (keys: string[]) => keys.join('\n');
  return (
    list(current.passed) === list(next.passed) &&
    list(current.deferred) === list(next.deferred) &&
    list(current.settled) === list(next.settled) &&
    list(current.recalled) === list(next.recalled)
  );
}

export function MemberHome({
  lang,
  intelligence,
  isLoading = false,
  greetingName,
  isSavingOrientation,
  orientationError,
  onChooseOrientation,
}: MemberHomeProps) {
  const t = useTranslations('MemberHome');
  const openChatRef = useRef<MemberHomeOpenChat>(async () => false);

  const onOpenChatReady = useCallback((openChat: MemberHomeOpenChat) => {
    openChatRef.current = openChat;
  }, []);
  const openChat = useCallback<MemberHomeOpenChat>(
    (person) => openChatRef.current(person),
    [],
  );
  const openCallRef = useRef<MemberHomeOpenChat>(async () => false);
  const onOpenCallReady = useCallback((openCall: MemberHomeOpenChat) => {
    openCallRef.current = openCall;
  }, []);
  const openCall = useCallback<MemberHomeOpenChat>(
    (person) => openCallRef.current(person),
    [],
  );
  const openVideoRef = useRef<MemberHomeOpenChat>(async () => false);
  const onOpenVideoReady = useCallback((openVideo: MemberHomeOpenChat) => {
    openVideoRef.current = openVideo;
  }, []);
  const openVideo = useCallback<MemberHomeOpenChat>(
    (person) => openVideoRef.current(person),
    [],
  );
  const memberFallback = t('fallbackMember');
  const home = isLoading || !intelligence ? null : intelligence;
  const [homeView, setHomeView] = useState<HomeView>('ai');
  const [viewReady, setViewReady] = useState(false);
  useEffect(() => {
    const sync = () => setHomeView(readHomeView());
    sync();
    setViewReady(true);
    window.addEventListener(HOME_VIEW_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(HOME_VIEW_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const showAssistant = viewReady && homeView === 'ai';
  const showField = viewReady && homeView === 'field';
  const rawOrientation = home?.person.primaryOrientation;
  const orientation = isSignupOrientation(rawOrientation)
    ? rawOrientation
    : null;
  const knownName =
    home?.person.name?.trim() ||
    home?.person.nickname?.trim() ||
    greetingName?.trim() ||
    '';
  const displayName = knownName || t('fallbackName');
  const greetingPending = home == null && !knownName;
  const queue = useMemo(
    () => (home ? listMemberHomeThreadItems(home) : []),
    [home],
  );
  if (home?.person.slug) bindHomePerson(home.person.slug);
  const queueSnapshot = useSyncExternalStore(
    subscribeHomeQueue,
    readHomeQueueSnapshot,
    () => EMPTY_HOME_QUEUE_SNAPSHOT,
  );
  const [chatMemory, setChatMemory] = useState<HomeQueueMemory | null>(null);
  const onQueueMemory = useCallback((memory: HomeQueueMemory) => {
    setChatMemory((current) =>
      sameHomeQueueMemory(current, memory) ? current : memory,
    );
  }, []);
  const attentionSource = useMemo(
    () => (home ? listMemberHomeAttentionItems(home) : []),
    [home],
  );
  const attentionOrder = useRef<MemberHomeThreadItem[]>([]);
  const attentionQueue = useMemo(() => {
    const stored = JSON.parse(queueSnapshot) as HomeQueueSnapshot;
    const waiting = memberHomeItemsStillWaiting(attentionSource, {
      passed: chatMemory?.passed ?? stored.passed,
      deferred: chatMemory?.deferred ?? stored.deferred,
      settled: chatMemory?.settled ?? stored.settled,
      acted: stored.acted,
      recalled: chatMemory?.recalled ?? [],
    });
    return mergeMemberHomeAttention(attentionOrder.current, waiting);
  }, [attentionSource, chatMemory, queueSnapshot]);
  attentionOrder.current = attentionQueue;
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const reachIds = useMemo(() => {
    if (!home) return [];
    const ids = new Set<number>();
    for (const signal of home.signals) {
      if (signal.creatorId) ids.add(signal.creatorId);
    }
    for (const proposal of home.proposals) {
      if (proposal.creatorId) ids.add(proposal.creatorId);
    }
    return [...ids];
  }, [home]);

  return (
    <div className="@container/home relative isolate -mt-4 flex h-[calc(100dvh-var(--menu-top-height,4.5rem)-var(--mobile-tab-offset,6rem))] min-h-0 w-full min-w-0 flex-col overflow-hidden pt-4 max-xl:-mb-8 md:-mt-5 md:pt-5 xl:h-[calc(100dvh-var(--menu-top-height,4.5rem)-1.25rem+var(--spacing-5))]">
      <div className="member-home-banner" aria-hidden>
        <img
          alt=""
          className="member-home-banner-image"
          src="/brand/strategy-mycelium.png"
        />
        <div className="member-home-banner-veil" />
      </div>
      <div className="flex min-h-0 w-full min-w-0 flex-1 overflow-hidden">
        <MemberHomeSpacesRail
          lang={lang}
          spaces={home?.spaces ?? []}
          isLoading={home == null}
        />
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden @min-[68rem]/home:grid @min-[68rem]/home:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)] @min-[68rem]/home:grid-rows-[minmax(0,1fr)] @min-[80rem]/home:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)_minmax(17rem,22rem)]',
            showField && 'max-xl:overflow-y-auto',
          )}
        >
          <aside
            aria-label={t('panelSpaces')}
            className={cn(
              'member-home-pane narrow-scrollbar col-start-1 row-start-1 hidden min-h-0 min-w-0 flex-col gap-4 overflow-x-hidden overflow-y-auto border-t border-border px-4 py-4 @min-[80rem]/home:flex @min-[80rem]/home:w-full @min-[80rem]/home:max-w-[20rem] @min-[80rem]/home:border-r @min-[80rem]/home:border-t-0',
              showField &&
                'max-xl:flex max-xl:shrink-0 max-xl:overflow-visible max-xl:border-0 max-xl:px-5',
            )}
          >
            <section
              aria-busy={home == null || undefined}
              className="flex w-full min-w-0 flex-col border border-border bg-background p-4"
            >
              <h2
                className="text-3"
                style={{ fontFamily: 'var(--font-family-heading)' }}
              >
                {t('overviewTitle')}
              </h2>
              <div
                className={
                  home == null || orientation
                    ? 'mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3'
                    : 'mt-3 grid'
                }
              >
                {home == null || orientation ? (
                  <div className="flex items-center justify-center">
                    {home == null || orientation == null ? (
                      <Skeleton loading height="22px" width="6.5rem" />
                    ) : (
                      <OrientationBadge
                        orientation={orientation}
                        isSaving={isSavingOrientation}
                        error={orientationError}
                        onChoose={onChooseOrientation}
                      />
                    )}
                  </div>
                ) : null}
                <dl className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2">
                  <Stat
                    label={t('counts.spaces')}
                    value={home?.counts.spaces ?? 0}
                    isLoading={home == null}
                  />
                  <Stat
                    label={t('counts.proposals')}
                    value={home?.counts.openProposals ?? 0}
                    isLoading={home == null}
                  />
                  <Stat
                    label={t('counts.signals')}
                    value={home?.counts.signals ?? 0}
                    isLoading={home == null}
                  />
                  <Stat
                    label={t('counts.people')}
                    value={home?.counts.connections ?? 0}
                    isLoading={home == null}
                  />
                </dl>
              </div>
            </section>

            <div>
              <MemberHomeWalletWidget
                lang={lang}
                personSlug={home?.person.slug}
                hasAddress={Boolean(home?.wallet.address)}
                isHomeLoading={home == null}
              />
            </div>
            <div>
              <Tile
                title={t('notifications')}
                count={
                  home && home.counts.notifications > 0
                    ? home.counts.notifications
                    : undefined
                }
                busy={home == null}
              >
                <ResourceList
                  isLoading={home == null}
                  empty={t('noNotifications')}
                  maxItems={5}
                  markSize={24}
                  items={
                    home
                      ? [...home.notifications]
                          .sort((left, right) => {
                            const leftAt = left.at ?? '';
                            const rightAt = right.at ?? '';
                            if (leftAt !== rightAt) {
                              return leftAt < rightAt ? 1 : -1;
                            }
                            return left.id < right.id ? -1 : 1;
                          })
                          .flatMap((item) => {
                            const match = queue.find(
                              (entry) =>
                                entry.kind === item.kind &&
                                entry.slug === item.targetSlug,
                            );
                            return [
                              {
                                id: item.id,
                                kind: item.kind,
                                title: item.title,
                                detail: item.detail,
                                icon: item.spaceLogo ?? null,
                                href:
                                  item.kind === 'signal'
                                    ? getSignalPath(
                                        lang,
                                        item.spaceSlug,
                                        item.targetSlug,
                                      )
                                    : getProposalPath(
                                        lang,
                                        item.spaceSlug,
                                        item.targetSlug,
                                      ),
                                ...(match
                                  ? {
                                      onSelect: () =>
                                        setFocusKey(
                                          `${match.kind}:${match.slug}`,
                                        ),
                                    }
                                  : {}),
                              },
                            ];
                          })
                      : []
                  }
                />
                {home && home.notifications.length > 5 ? (
                  <Button asChild className="mt-4 w-full text-sm">
                    <Link href={`/${lang}/home/notifications`}>
                      {t('seeMoreNotifications')}
                    </Link>
                  </Button>
                ) : null}
              </Tile>
            </div>
          </aside>
          <main
            className={cn(
              'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden @min-[68rem]/home:col-start-1 @min-[68rem]/home:row-start-1 @min-[80rem]/home:col-start-2',
              showField && 'max-xl:hidden',
            )}
          >
            <div className="shrink-0 px-5 pt-4 md:px-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className="inline-flex shrink-0"
                    style={{ width: 24, height: 24 }}
                  >
                    <MemberHomeMark className="h-full w-full" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {greetingPending ? (
                      <HomePulse className="h-9 w-56 max-w-full" />
                    ) : (
                      <h1
                        className="truncate text-7"
                        style={{ fontFamily: 'var(--font-family-heading)' }}
                      >
                        {t(greetingKey(), { name: displayName })}
                      </h1>
                    )}
                  </div>
                </div>
                <HomeViewSwitch
                  view={homeView}
                  ready={viewReady}
                  onChange={writeHomeView}
                />
              </div>
              <div className="min-w-0 pt-1 pl-[calc(24px+var(--spacing-3))]">
                {home == null ? (
                  <div className="mt-2 flex gap-2" aria-hidden>
                    {Array.from({ length: 5 }, (_, index) => (
                      <HomePulse
                        key={index}
                        className="h-8 w-8 rounded-full"
                        delayMs={index * 70}
                      />
                    ))}
                  </div>
                ) : (
                  <MemberHomeClosest
                    lang={lang}
                    people={home.connections}
                    fallbackName={memberFallback}
                    onOpenChat={openChat}
                  />
                )}
              </div>
            </div>
            {home && showAssistant ? (
              <MemberHomeChat
                lang={lang}
                intelligence={home}
                onChatPerson={openChat}
                onCallPerson={openCall}
                onVideoPerson={openVideo}
                onQueueMemory={onQueueMemory}
              />
            ) : home && viewReady ? (
              <ClassicBoard
                lang={lang}
                home={home}
                queue={queue}
                focusKey={focusKey}
                onChat={openChat}
                onCall={openCall}
              />
            ) : (
              <ChatSkeleton />
            )}
          </main>
          <aside
            aria-label={t('panelInsights')}
            className={cn(
              'narrow-scrollbar row-start-1 hidden min-h-0 flex-col gap-4 overflow-y-auto border-l border-border bg-transparent px-4 py-4 @min-[68rem]/home:col-start-2 @min-[68rem]/home:flex @min-[80rem]/home:col-start-3',
              showField &&
                'max-xl:flex max-xl:shrink-0 max-xl:overflow-visible max-xl:border-0 max-xl:px-5',
            )}
          >
            {orientation === 'member' && home ? (
              <PersonaCard
                title={t('memberTitle')}
                body={t('memberBody')}
                action={t('memberAction')}
                href={`/${lang}/my-spaces`}
                meta={t('memberCount', { count: home.counts.spaces })}
              />
            ) : null}
            {orientation === 'builder' ? (
              <PersonaCard
                title={t('builderTitle')}
                body={t('builderBody')}
                action={t('builderAction')}
                href={getOnboardingPath(lang)}
              />
            ) : null}
            {home && home.invites.length > 0 ? (
              <MemberHomeInviteBanners lang={lang} invites={home.invites} />
            ) : null}
            {home?.person.slug ? (
              <MemberHomeEnergyPanel personSlug={home.person.slug} />
            ) : null}
            {orientation === 'investor' && home ? (
              <PersonaCard
                title={t('investorTitle')}
                body={t('investorBody')}
                action={t('investorAction')}
                href={`/${lang}/network/needs`}
                meta={t('investorCount', {
                  count: home.counts.capitalAsks,
                })}
              />
            ) : null}
            {home != null && orientation == null ? (
              <section className="border border-border bg-background p-4">
                <h2
                  className="text-3"
                  style={{ fontFamily: 'var(--font-family-heading)' }}
                >
                  {t('chooseTitle')}
                </h2>
                <p className="mt-3 max-w-[48ch] text-1 leading-relaxed text-neutral-11">
                  {t('chooseBody')}
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {ORIENTATIONS.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant="outline"
                      colorVariant="neutral"
                      disabled={isSavingOrientation}
                      onClick={() => onChooseOrientation(option)}
                    >
                      {t(orientationLabelKey(option))}
                    </Button>
                  ))}
                </div>
                {orientationError ? (
                  <p className="mt-3 text-1 text-error-11" role="alert">
                    {orientationError}
                  </p>
                ) : null}
              </section>
            ) : null}

            <div>
              <AttentionNeeded
                lang={lang}
                home={home}
                queue={attentionQueue}
                onSelect={setFocusKey}
              />
            </div>

            <div className="grid gap-4">
              <MemberHomeConnectionsWidget
                lang={lang}
                people={home?.connections ?? []}
                isLoading={home == null}
                fallbackName={memberFallback}
                onChat={home ? openChat : undefined}
                onCall={home ? openCall : undefined}
                onVideo={home ? openVideo : undefined}
              />
              {home ? (
                <MemberHomePeople
                  people={home.connections}
                  chatSpaceSlug={home.chatSpaceSlug}
                  fallbackName={memberFallback}
                  extraPersonIds={reachIds}
                  onOpenChatReady={onOpenChatReady}
                  onOpenCallReady={onOpenCallReady}
                  onOpenVideoReady={onOpenVideoReady}
                />
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function OrientationBadge({
  orientation,
  isSaving,
  error,
  onChoose,
}: {
  orientation: SignupOrientation;
  isSaving?: boolean;
  error?: string | null;
  onChoose: (orientation: SignupOrientation) => void;
}) {
  const t = useTranslations('MemberHome');
  const tWelcome = useTranslations('WelcomeFlow');
  const [open, setOpen] = useState(false);
  const label = t(orientationLabelKey(orientation));

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={isSaving}
            aria-label={t('changeOrientationLabel', { orientation: label })}
            className="inline-flex w-full items-center justify-center rounded-none text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
          >
            <PersonRoleBadge role={orientation} stacked />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(22rem,calc(100vw-2.5rem))] rounded-none border-border bg-background p-2 text-foreground shadow-sm"
        >
          <p className="px-3 py-2 text-1 text-neutral-11">{t('chooseTitle')}</p>
          <div className="grid gap-1">
            {ORIENTATIONS.map((option) => {
              const selected = option === orientation;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={isSaving}
                  aria-pressed={selected}
                  onClick={() => {
                    setOpen(false);
                    if (option !== orientation) onChoose(option);
                  }}
                  className={cn(
                    'border px-3 py-3 text-left transition-colors disabled:opacity-60',
                    selected
                      ? 'border-foreground'
                      : 'border-transparent hover:border-border',
                  )}
                >
                  <span className="block text-1 text-foreground">
                    {t(orientationLabelKey(option))}
                  </span>
                  <span className="mt-1 block text-1 leading-relaxed text-neutral-11">
                    {tWelcome(orientationBodyKey(option))}
                  </span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      {error ? (
        <p className="mt-3 text-1 text-error-11" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function orientationBodyKey(orientation: SignupOrientation) {
  if (orientation === 'member') return 'orientation.member.body' as const;
  if (orientation === 'builder') return 'orientation.builder.body' as const;
  return 'orientation.investor.body' as const;
}

function HomeViewSwitch({
  view,
  ready,
  onChange,
}: {
  view: HomeView;
  ready: boolean;
  onChange: (view: HomeView) => void;
}) {
  const t = useTranslations('MemberHome');
  return (
    <div
      role="group"
      aria-label={t('viewToggleLabel')}
      className="ml-auto hidden shrink-0 border border-foreground xl:inline-flex"
    >
      {(['ai', 'classic'] as const).map((option) => {
        const selected = ready && view === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            disabled={!ready}
            onClick={() => {
              if (option !== view) onChange(option);
            }}
            className={cn(
              'px-3 py-1 text-1 disabled:opacity-60',
              selected
                ? 'bg-foreground text-background'
                : 'bg-background text-foreground',
            )}
          >
            {option === 'ai' ? t('viewAi') : t('viewClassic')}
          </button>
        );
      })}
    </div>
  );
}

function itemKey(item: MemberHomeThreadItem) {
  return `${item.kind}:${item.slug}`;
}

function ClassicBoard({
  lang,
  home,
  queue,
  focusKey,
  onChat,
  onCall,
}: {
  lang: Locale;
  home: MemberIntelligence;
  queue: MemberHomeThreadItem[];
  focusKey: string | null;
  onChat: MemberHomeOpenChat;
  onCall: MemberHomeOpenChat;
}) {
  const t = useTranslations('MemberHome');
  const boardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusKey) return;
    const node = boardRef.current?.querySelector(
      `[data-home-focus="${CSS.escape(focusKey)}"]`,
    );
    if (node instanceof HTMLElement) {
      node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusKey]);
  return (
    <div
      ref={boardRef}
      className="narrow-scrollbar @container min-h-0 flex-1 overflow-y-auto py-6"
    >
      <div className={cn(HOME_CHAT_COLUMN, 'px-5 md:px-4')}>
        <h2
          className="text-3"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('useful')}
        </h2>
        <p className="mt-1 text-1 text-neutral-11">{t('classicOrder')}</p>
        {queue.length === 0 ? (
          <p className="mt-4 text-1 text-neutral-11">{t('quiet')}</p>
        ) : (
          <div className="mt-4 grid w-full grid-cols-1 items-start gap-4">
            {queue.map((item) => {
              const key = itemKey(item);
              return (
                <div
                  key={key}
                  data-home-focus={key}
                  className={cn(
                    'min-w-0',
                    focusKey === key && 'ring-1 ring-foreground',
                  )}
                >
                  <MemberHomeThreadCard
                    lang={lang}
                    item={item}
                    assistant={false}
                    proposal={
                      item.kind === 'proposal'
                        ? home.proposals.find(
                            (proposal) => proposal.slug === item.slug,
                          ) ?? null
                        : null
                    }
                    onAsk={() => undefined}
                    onReach={(person, mode) =>
                      mode === 'call' ? onCall(person) : onChat(person)
                    }
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Same pulse as the signals board: square, a tenth of the ink, staggered. */
function HomePulse({
  className,
  delayMs = 0,
  style,
}: {
  className?: string;
  delayMs?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn('animate-pulse rounded-none bg-foreground/10', className)}
      style={{
        ...style,
        ...(delayMs ? { animationDelay: `${delayMs}ms` } : {}),
      }}
      aria-hidden
    />
  );
}

function CardSkeleton({
  lines = 3,
  detail = true,
  mark = 32,
}: {
  lines?: number;
  detail?: boolean;
  mark?: number;
}) {
  return (
    <div className="grid gap-3" aria-hidden>
      {Array.from({ length: lines }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <HomePulse
            className="shrink-0"
            delayMs={index * 80}
            style={{ width: mark, height: mark }}
          />
          <div className="grid min-w-0 flex-1 gap-1.5">
            <HomePulse
              className="h-3 w-3/5 max-w-48"
              delayMs={index * 80 + 40}
            />
            {detail ? (
              <HomePulse
                className="h-3 w-2/5 max-w-32"
                delayMs={index * 80 + 80}
              />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Empty conversation plus the chip row and composer that stay on screen. */
function ChatSkeleton() {
  const chipWidths = [88, 72, 96, 80, 104];
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-hidden>
      <div className="min-h-0 flex-1" />
      <div className={cn(HOME_CHAT_COLUMN, 'shrink-0 pb-3')}>
        <div className="mx-5 mb-2 flex min-w-0 flex-nowrap gap-1.5 overflow-hidden pt-2 md:mx-4">
          {chipWidths.map((width, index) => (
            <HomePulse
              key={width}
              className="h-8 shrink-0 border border-foreground/15 bg-transparent"
              delayMs={index * 60}
              style={{ width }}
            />
          ))}
        </div>
        <div className="mx-5 flex h-11 items-center gap-2 border border-border px-3 md:mx-4">
          <HomePulse className="h-3 min-w-0 flex-1" delayMs={80} />
          <HomePulse className="h-8 w-8 shrink-0" delayMs={120} />
          <HomePulse className="h-8 w-8 shrink-0" delayMs={160} />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  isLoading = false,
}: {
  label: string;
  value: number;
  isLoading?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-1 leading-tight tracking-[0.04em] break-words text-neutral-11 uppercase">
        {label}
      </dt>
      <dd
        className="mt-1 text-2 leading-none tabular-nums"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        <Skeleton
          loading={isLoading}
          width="2.25rem"
          height="18px"
          className="rounded-none bg-foreground/10"
        >
          {value.toLocaleString()}
        </Skeleton>
      </dd>
    </div>
  );
}

function Tile({
  title,
  count,
  children,
  busy = false,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  busy?: boolean;
}) {
  return (
    <section
      aria-busy={busy || undefined}
      className="flex w-full min-w-0 flex-col border border-border bg-background p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          className="text-3"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {title}
        </h2>
        {count != null ? (
          <p className="text-1 tabular-nums text-neutral-11">{count}</p>
        ) : null}
      </div>
      <div className="mt-3 flex-1">{children}</div>
    </section>
  );
}

const ATTENTION_PAGE = 5;

function AttentionNeeded({
  lang,
  home,
  queue,
  onSelect,
}: {
  lang: Locale;
  home: MemberIntelligence | null;
  queue: MemberHomeThreadItem[];
  onSelect: (key: string) => void;
}) {
  const t = useTranslations('MemberHome');
  const tTypes = useTranslations('CoherenceTab');
  const items = queue.flatMap((item) => {
    const typeName = item.category?.trim();
    const typeKey = typeName ? (`types.${typeName}` as 'types.Need') : null;
    const typeLabel =
      typeKey && tTypes.has(typeKey) ? tTypes(typeKey) : typeName;
    return [
      {
        id: `${item.kind}:${item.slug}`,
        kind: item.kind,
        title: item.title,
        detail:
          item.kind === 'signal'
            ? [typeLabel, item.spaceTitle].filter(Boolean).join(' · ')
            : [item.spaceTitle, item.documentKind].filter(Boolean).join(' · '),
        href:
          item.kind === 'proposal'
            ? getProposalPath(lang, item.spaceSlug, item.slug)
            : getSignalPath(lang, item.spaceSlug, item.slug),
        onSelect: () => onSelect(`${item.kind}:${item.slug}`),
        icon: item.spaceLogo ?? null,
      },
    ];
  });

  return (
    <Tile
      title={t('waiting')}
      count={items.length > 0 ? items.length : undefined}
      busy={home == null}
    >
      <ResourceList
        isLoading={home == null}
        empty={t('noWaiting')}
        maxItems={ATTENTION_PAGE}
        items={items}
      />
      {items.length > ATTENTION_PAGE ? (
        <Button asChild className="mt-4 w-full text-sm">
          <Link href={`/${lang}/home/attention`}>{t('seeMore')}</Link>
        </Button>
      ) : null}
    </Tile>
  );
}

function ResourceMark({
  kind,
  iconUrl,
  size = 32,
}: {
  kind?: 'signal' | 'proposal';
  iconUrl?: string | null;
  size?: 24 | 32;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const Icon = kind === 'proposal' ? Scale : kind === 'signal' ? Radio : null;
  const showLogo = Boolean(iconUrl) && !logoFailed;
  return (
    <span
      className="craft-icon-box text-foreground"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl ?? undefined}
          alt=""
          className="size-full object-cover"
          onError={() => setLogoFailed(true)}
        />
      ) : Icon ? (
        <Icon />
      ) : null}
    </span>
  );
}

function ResourceList({
  items,
  empty,
  isLoading = false,
  maxItems = 4,
  markSize = 32,
}: {
  items: Array<{
    id: string | number;
    kind?: 'signal' | 'proposal';
    title: string;
    detail: string;
    href: string;
    onSelect?: () => void;
    icon?: {
      logoUrl: string | null;
      ecosystemLogoUrlLight?: string | null;
      ecosystemLogoUrlDark?: string | null;
    } | null;
  }>;
  empty: string;
  isLoading?: boolean;
  maxItems?: number;
  markSize?: 24 | 32;
}) {
  const { resolvedTheme } = useTheme();
  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';
  if (isLoading) {
    return <CardSkeleton lines={maxItems} mark={markSize} />;
  }
  if (items.length === 0) {
    return <p className="text-1 text-neutral-11">{empty}</p>;
  }
  return (
    <ul className="grid gap-3">
      {items.slice(0, maxItems).map((item) => {
        const iconUrl = resolveSpaceDisplayLogoUrl(
          item.icon
            ? {
                logoUrl: item.icon.logoUrl,
                ecosystemLogoUrlLight: item.icon.ecosystemLogoUrlLight ?? null,
                ecosystemLogoUrlDark: item.icon.ecosystemLogoUrlDark ?? null,
              }
            : null,
          logoVariant,
        );
        return (
          <li key={item.id}>
            <Link
              href={item.href}
              className="group flex items-center gap-3"
              onClick={(event) => {
                if (!item.onSelect) return;
                if (
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey ||
                  event.button !== 0
                ) {
                  return;
                }
                event.preventDefault();
                item.onSelect();
              }}
            >
              <ResourceMark
                kind={item.kind}
                iconUrl={iconUrl}
                size={markSize}
              />
              <span className="min-w-0">
                <span className="block text-1 group-hover:underline">
                  {item.title}
                </span>
                {item.detail ? (
                  <span className="mt-0.5 block text-1 text-neutral-11 line-clamp-2">
                    {item.detail}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function PersonaCard({
  title,
  body,
  action,
  href,
  meta,
}: {
  title: string;
  body: string;
  action: string;
  href: string;
  meta?: string;
}) {
  return (
    <section className="border border-border bg-background p-4">
      <h2
        className="text-3"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {title}
      </h2>
      <p className="mt-3 max-w-[52ch] text-1 leading-relaxed text-neutral-11">
        {body}
      </p>
      {meta ? <p className="mt-2 text-1 text-neutral-11">{meta}</p> : null}
      <Button asChild className="mt-4 w-full text-sm">
        <Link href={href}>{action}</Link>
      </Button>
    </section>
  );
}
