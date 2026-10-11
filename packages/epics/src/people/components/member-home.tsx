'use client';

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Locale } from '@hypha-platform/i18n';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import {
  listMemberHomeThreadItems,
  type MemberHomeThreadItem,
  type MemberIntelligence,
} from '@hypha-platform/core/client';

import {
  getOnboardingPath,
  getProposalPath,
  getSignalPath,
} from '../../common/get-path-function';
import type { SignupOrientation } from './signup-flow';
import {
  SpaceSwitcherMark,
  SpaceSwitcherOption,
} from '../../spaces/components/space-switcher-option';
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';
import {
  MAX_VISIBLE_RECENT_SPACES,
  readRecentSpaceSlugs,
  subscribeRecentSpaceSlugs,
} from '../../common/recent-space-history';
import { requestMemberHomeAsk } from './member-home-ask';
import { MemberHomeChat } from './member-home-chat';
import { MemberHomeThreadCard } from './member-home-thread-card';
import { MemberHomeMark } from './member-home-mark';
import { PersonRoleBadge } from './person-badges';
import { MemberHomeInviteBanners } from './member-home-invite-banner';
import { MemberHomeQuickCreate } from './member-home-quick-create';
import { MemberHomeClosest } from './member-home-closest';
import {
  MemberHomePeople,
  type MemberHomeOpenChat,
} from './member-home-people';
import {
  MemberHomeConnectionsWidget,
  MemberHomeSpacesWidget,
  MemberHomeWalletWidget,
} from './member-home-side-widgets';
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
const HOME_VIEW_KEY = 'hypha-member-home-view';

type HomeView = 'ai' | 'classic';

function readHomeView(): HomeView {
  try {
    return window.localStorage.getItem(HOME_VIEW_KEY) === 'classic'
      ? 'classic'
      : 'ai';
  } catch {
    return 'ai';
  }
}

function writeHomeView(view: HomeView) {
  try {
    window.localStorage.setItem(HOME_VIEW_KEY, view);
  } catch {
    // Private browsing can block storage. The choice still applies this visit.
  }
}

const CARD_SKELETON_WIDTHS = ['72%', '100%', '84%', '64%'];

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
  const { resolvedTheme } = useTheme();
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
  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';
  const memberFallback = t('fallbackMember');
  const home = isLoading || !intelligence ? null : intelligence;
  const [recentSpaceSlugs, setRecentSpaceSlugs] = useState<string[]>(() =>
    readRecentSpaceSlugs(),
  );
  useEffect(() => subscribeRecentSpaceSlugs(setRecentSpaceSlugs), []);
  const [homeView, setHomeView] = useState<HomeView>('ai');
  const [viewReady, setViewReady] = useState(false);
  useEffect(() => {
    setHomeView(readHomeView());
    setViewReady(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key === HOME_VIEW_KEY) setHomeView(readHomeView());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const showAssistant = viewReady && homeView === 'ai';
  const recentSpaces = useMemo(() => {
    const spaces = home?.spaces ?? [];
    if (recentSpaceSlugs.length === 0) return spaces;
    const bySlug = new Map(spaces.map((space) => [space.slug, space]));
    const visited = recentSpaceSlugs.flatMap((slug) => {
      const space = bySlug.get(slug);
      return space ? [space] : [];
    });
    const visible = visited.slice(0, MAX_VISIBLE_RECENT_SPACES);
    return visible.length > 0 ? visible : spaces;
  }, [home?.spaces, recentSpaceSlugs]);
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
  const tTypes = useTranslations('CoherenceTab');
  const queue = useMemo(
    () => (home ? listMemberHomeThreadItems(home) : []),
    [home],
  );
  const [spokenItem, setSpokenItem] = useState<MemberHomeThreadItem | null>(
    null,
  );
  const [recordItem, setRecordItem] = useState<MemberHomeThreadItem | null>(
    null,
  );
  const onFocusItem = useCallback((item: MemberHomeThreadItem | null) => {
    setSpokenItem(item);
  }, []);
  const leadItem =
    (spokenItem &&
      queue.find(
        (item) =>
          item.kind === spokenItem.kind && item.slug === spokenItem.slug,
      )) ||
    queue[0] ||
    null;
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
  const leadHref = leadItem
    ? leadItem.kind === 'proposal'
      ? getProposalPath(lang, leadItem.spaceSlug, leadItem.slug)
      : getSignalPath(lang, leadItem.spaceSlug, leadItem.slug)
    : null;

  return (
    <div className="relative isolate flex min-h-[calc(100dvh-var(--menu-top-height,4.5rem))] w-full flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 lg:grid lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)_minmax(17rem,22rem)] lg:items-start lg:pb-0">
      <div className="member-home-banner" aria-hidden>
        <img
          alt=""
          className="member-home-banner-image"
          src="/brand/strategy-mycelium.png"
        />
        <div className="member-home-banner-veil" />
      </div>
      <aside
        aria-label={t('panelSpaces')}
        className="member-home-pane order-2 border-t border-border px-4 py-4 lg:order-none lg:col-start-1 lg:row-start-1 lg:border-r lg:border-t-0"
      >
        <MemberHomeSpacesWidget lang={lang} busy={home == null}>
          {home == null ? (
            <CardSkeleton />
          ) : recentSpaces.length === 0 ? (
            <p className="text-1 text-neutral-11">{t('noSpaces')}</p>
          ) : (
            <ul className="grid">
              {recentSpaces.map((space) => (
                <li key={space.id}>
                  <SpaceSwitcherOption
                    href={`/${lang}/dho/${space.slug}/overview`}
                    title={space.title}
                    iconUrl={resolveSpaceDisplayLogoUrl(space, logoVariant)}
                    className="rounded-lg px-2 py-1.5 text-1 hover:bg-background-4/70"
                  />
                </li>
              ))}
            </ul>
          )}
        </MemberHomeSpacesWidget>
        <div className="mt-4">
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
              items={
                home
                  ? home.notifications.flatMap((item) => {
                      const match = queue.find(
                        (entry) =>
                          entry.kind === item.kind &&
                          entry.slug === item.targetSlug,
                      );
                      return [
                        {
                          id: item.id,
                          title: item.title,
                          detail: item.detail,
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
                            ? { onSelect: () => setRecordItem(match) }
                            : {}),
                        },
                      ];
                    })
                  : []
              }
            />
            {home && home.notifications.length > 5 ? (
              <TileLink href={`/${lang}/home/notifications`}>
                {t('seeMoreNotifications')}
              </TileLink>
            ) : null}
          </Tile>
        </div>
      </aside>
      <main className="order-1 flex min-w-0 flex-col lg:order-none lg:col-start-2 lg:row-start-1">
        <div className="px-4 pt-4 md:px-6">
          <div className="flex min-w-0 flex-wrap items-start gap-3 pt-4">
            <span
              className="mt-px inline-flex shrink-0"
              style={{ width: 24, height: 24 }}
            >
              <MemberHomeMark className="h-full w-full" />
            </span>
            <div className="min-w-0 flex-1">
              {greetingPending ? (
                <Skeleton
                  loading
                  height="28px"
                  width="14rem"
                  className="rounded-none"
                />
              ) : (
                <h1
                  className="truncate text-3"
                  style={{ fontFamily: 'var(--font-family-heading)' }}
                >
                  {t(greetingKey(), { name: displayName })}
                </h1>
              )}
              {home == null ? (
                <Skeleton
                  loading
                  height="16px"
                  width="14rem"
                  className="mt-1"
                />
              ) : (
                <>
                  <MemberHomeClosest
                    lang={lang}
                    people={home.connections}
                    fallbackName={memberFallback}
                    onOpenChat={openChat}
                  />
                </>
              )}
            </div>
            <HomeViewSwitch
              view={homeView}
              ready={viewReady}
              onChange={(next) => {
                writeHomeView(next);
                setHomeView(next);
              }}
            />
          </div>
        </div>
        {home && showAssistant ? (
          <MemberHomeChat
            lang={lang}
            intelligence={home}
            onChatPerson={openChat}
            onCallPerson={openCall}
            onVideoPerson={openVideo}
            onFocusItem={onFocusItem}
          />
        ) : home && viewReady ? (
          <ClassicBoard
            lang={lang}
            home={home}
            queue={queue}
            onChat={openChat}
            onCall={openCall}
          />
        ) : (
          <div className="flex-1 px-4 py-6">
            <CardSkeleton lines={4} plain />
          </div>
        )}
      </main>
      <aside
        aria-label={t('panelInsights')}
        className="member-home-pane order-3 border-t border-border px-4 py-4 lg:order-none lg:col-start-3 lg:row-start-1 lg:border-l lg:border-t-0"
      >
        {home && home.invites.length > 0 ? (
          <MemberHomeInviteBanners lang={lang} invites={home.invites} />
        ) : null}
        <section className="border border-border bg-background">
          <div
            className={
              home == null || orientation
                ? 'grid grid-cols-[auto_minmax(0,1fr)]'
                : 'grid'
            }
          >
            {home == null || orientation ? (
              <div className="flex items-start border-r border-border px-4 py-4">
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
            <dl className="grid grid-cols-2">
              <Stat
                label={t('counts.spaces')}
                value={home?.counts.spaces ?? 0}
                isLoading={home == null}
              />
              <Stat
                label={t('counts.proposals')}
                value={home?.counts.openProposals ?? 0}
                isLoading={home == null}
                edge
              />
              <Stat
                label={t('counts.signals')}
                value={home?.counts.signals ?? 0}
                isLoading={home == null}
                rule
              />
              <Stat
                label={t('counts.people')}
                value={home?.counts.connections ?? 0}
                isLoading={home == null}
                edge
                rule
              />
            </dl>
          </div>
        </section>

        <div className="mt-4 grid gap-4">
          <MemberHomeWalletWidget
            lang={lang}
            personSlug={home?.person.slug}
            hasAddress={Boolean(home?.wallet.address)}
            isHomeLoading={home == null}
          />
          {home ? (
            <MemberHomeQuickCreate lang={lang} spaces={home.spaces} />
          ) : null}
        </div>

        {orientation === 'builder' ? (
          <PersonaCard
            title={t('builderTitle')}
            body={t('builderBody')}
            action={t('builderAction')}
            href={getOnboardingPath(lang)}
          />
        ) : null}
        {orientation === 'investor' && home ? (
          <PersonaCard
            title={t('investorTitle')}
            body={t('investorBody')}
            action={t('investorAction')}
            href={`/${lang}/network/marketplace`}
            meta={t('investorCount', {
              count: home.counts.capitalAsks,
            })}
          />
        ) : null}
        {home != null && orientation == null ? (
          <section className="mb-4 border border-border bg-background p-5">
            <h2
              className="text-3"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {t('chooseTitle')}
            </h2>
            <p className="mt-2 max-w-[48ch] text-1 leading-relaxed text-neutral-11">
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

        <section
          className="mt-10 border border-border bg-background p-5"
          aria-busy={home == null || undefined}
        >
          <div className="flex items-baseline justify-between gap-4">
            <h2
              className="text-3"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {home && !leadItem ? t('quietHeading') : t('useful')}
            </h2>
            {leadItem ? (
              <p className="text-1 tracking-[0.12em] text-neutral-11 uppercase">
                {leadItem.spaceTitle}
              </p>
            ) : null}
          </div>
          {home == null ? (
            <div className="mt-4">
              <CardSkeleton lines={3} plain />
            </div>
          ) : leadItem && home ? (
            <div className="mt-4">
              <MemberHomeThreadCard
                lang={lang}
                compact
                assistant={showAssistant}
                item={leadItem}
                proposal={
                  leadItem.kind === 'proposal'
                    ? home.proposals.find(
                        (item) => item.slug === leadItem.slug,
                      ) ?? null
                    : null
                }
                onAsk={requestMemberHomeAsk}
                onReach={(person, mode) =>
                  mode === 'call' ? openCall(person) : openChat(person)
                }
              />
            </div>
          ) : leadItem ? (
            <div className="mt-4">
              <p className="text-1">{leadItem.title}</p>
              <p className="mt-1 text-1 text-neutral-11">
                {leadItem.spaceTitle}
              </p>
              {leadHref ? (
                <Button asChild className="mt-4">
                  <Link href={leadHref}>
                    {leadItem.kind === 'proposal'
                      ? t('weighIn')
                      : t('viewSignal')}
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 grid gap-2">
              {home.counts.spaces > 0 ? (
                <Link
                  href={`/${lang}/profile/${home.person.slug}/actions/activate-spaces`}
                  className="border border-border bg-background px-4 py-3 text-foreground hover:border-foreground"
                >
                  <span className="block text-1">{t('quietActivate')}</span>
                  <span className="mt-1 block text-1 leading-relaxed text-neutral-11">
                    {t('quietActivateBody')}
                  </span>
                </Link>
              ) : (
                <Link
                  href={getOnboardingPath(lang)}
                  className="border border-border bg-background px-4 py-3 text-foreground hover:border-foreground"
                >
                  <span className="block text-1">{t('createSpace')}</span>
                  <span className="mt-1 block text-1 leading-relaxed text-neutral-11">
                    {t('quietCreateBody')}
                  </span>
                </Link>
              )}
            </div>
          )}
        </section>

        <div className="mt-4">
          <Tile title={t('waiting')} busy={home == null}>
            <ResourceList
              isLoading={home == null}
              empty={t('noWaiting')}
              maxItems={6}
              items={
                home
                  ? [
                      ...queue.flatMap((item) => {
                        if (
                          leadItem &&
                          item.kind === leadItem.kind &&
                          item.slug === leadItem.slug
                        ) {
                          return [];
                        }
                        const typeName = item.category?.trim();
                        const typeKey = typeName
                          ? (`types.${typeName}` as 'types.Need')
                          : null;
                        const typeLabel =
                          typeKey && tTypes.has(typeKey)
                            ? tTypes(typeKey)
                            : typeName;
                        return [
                          {
                            id: `${item.kind}:${item.slug}`,
                            title: item.title,
                            detail:
                              item.kind === 'signal'
                                ? [typeLabel, item.spaceTitle]
                                    .filter(Boolean)
                                    .join(' · ')
                                : [item.spaceTitle, item.documentKind]
                                    .filter(Boolean)
                                    .join(' · '),
                            href:
                              item.kind === 'proposal'
                                ? getProposalPath(
                                    lang,
                                    item.spaceSlug,
                                    item.slug,
                                  )
                                : getSignalPath(
                                    lang,
                                    item.spaceSlug,
                                    item.slug,
                                  ),
                            onSelect: () => setRecordItem(item),
                            icon: item.spaceLogo ?? null,
                          },
                        ];
                      }),
                      ...(home.movement ?? []).map((item) => ({
                        id: item.id,
                        title:
                          item.kind === 'joined'
                            ? t('movementJoined', { name: item.title })
                            : item.title,
                        detail: item.spaceTitle,
                        href: item.documentSlug
                          ? getProposalPath(
                              lang,
                              item.spaceSlug,
                              item.documentSlug,
                            )
                          : `/${lang}/dho/${item.spaceSlug}/${
                              item.kind === 'treasury' ? 'treasury' : 'members'
                            }`,
                        icon: item.spaceLogo ?? null,
                      })),
                    ]
                  : []
              }
            />
          </Tile>
        </div>

        <div className="mt-8 grid gap-4">
          <MemberHomeConnectionsWidget
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
      <Dialog
        modal={false}
        open={recordItem != null}
        onOpenChange={(open) => {
          if (!open) setRecordItem(null);
        }}
      >
        <DialogContent className="gap-0 border-border bg-background p-4 pt-10 shadow-none sm:rounded-none">
          <DialogTitle className="sr-only">
            {recordItem?.title ?? t('useful')}
          </DialogTitle>
          {recordItem && home ? (
            <MemberHomeThreadCard
              lang={lang}
              item={recordItem}
              assistant={showAssistant}
              proposal={
                recordItem.kind === 'proposal'
                  ? home.proposals.find(
                      (proposal) => proposal.slug === recordItem.slug,
                    ) ?? null
                  : null
              }
              onAsk={(text) => {
                setRecordItem(null);
                requestMemberHomeAsk(text);
              }}
              onReach={(person, mode) => {
                setRecordItem(null);
                return mode === 'call' ? openCall(person) : openChat(person);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
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
            className="inline-flex items-center gap-2 rounded-none text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
          >
            <PersonRoleBadge role={orientation} />
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
      className="ml-auto inline-flex shrink-0 border border-foreground"
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

function ClassicBoard({
  lang,
  home,
  queue,
  onChat,
  onCall,
}: {
  lang: Locale;
  home: MemberIntelligence;
  queue: MemberHomeThreadItem[];
  onChat: MemberHomeOpenChat;
  onCall: MemberHomeOpenChat;
}) {
  const t = useTranslations('MemberHome');
  return (
    <div className="px-4 py-6 md:px-6">
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
        <div className="mt-4 grid gap-4">
          {queue.map((item) => (
            <MemberHomeThreadCard
              key={`${item.kind}:${item.slug}`}
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
          ))}
        </div>
      )}
    </div>
  );
}

function CardSkeleton({
  lines = 3,
  plain = false,
}: {
  lines?: number;
  plain?: boolean;
}) {
  return (
    <div className="grid gap-3" aria-hidden>
      {Array.from({ length: lines }, (_, index) =>
        plain ? (
          <Skeleton
            key={index}
            loading
            className="rounded-none"
            height="12px"
            width={CARD_SKELETON_WIDTHS[index] ?? '70%'}
          />
        ) : (
          <div key={index} className="flex items-center gap-2">
            <Skeleton
              loading
              className="shrink-0 rounded-none"
              height="16px"
              width="16px"
            />
            <Skeleton
              loading
              className="rounded-none"
              height="12px"
              width={CARD_SKELETON_WIDTHS[index] ?? '70%'}
            />
          </div>
        ),
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  isLoading = false,
  edge = false,
  rule = false,
}: {
  label: string;
  value: number;
  isLoading?: boolean;
  edge?: boolean;
  rule?: boolean;
}) {
  return (
    <div
      className={cn(
        'min-w-0 overflow-hidden bg-background px-3 py-4',
        edge && 'border-l border-border',
        rule && 'border-t border-border',
      )}
    >
      <dt className="text-1 leading-tight tracking-[0.08em] text-neutral-11 uppercase">
        {label}
      </dt>
      <dd
        className="mt-1.5 text-3 leading-none tabular-nums"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        <Skeleton loading={isLoading} width="2.75rem" height="30px">
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
      className="flex flex-col border border-border bg-background p-4"
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

function TileLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="mt-4 inline-block text-1 text-accent-11 underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}

function ResourceList({
  items,
  empty,
  isLoading = false,
  maxItems = 4,
}: {
  items: Array<{
    id: string | number;
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
}) {
  const { resolvedTheme } = useTheme();
  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';
  if (isLoading) return <CardSkeleton />;
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
              className="group flex items-start gap-2"
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
              <SpaceSwitcherMark iconUrl={iconUrl} alt="" />
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
    <section className="mb-4 border border-border bg-accent-2 p-5">
      <h2
        className="text-3"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {title}
      </h2>
      <p className="mt-2 max-w-[52ch] text-1 leading-relaxed text-neutral-11">
        {body}
      </p>
      {meta ? <p className="mt-2 text-1 text-neutral-11">{meta}</p> : null}
      <Button asChild className="mt-4">
        <Link href={href}>{action}</Link>
      </Button>
    </section>
  );
}
