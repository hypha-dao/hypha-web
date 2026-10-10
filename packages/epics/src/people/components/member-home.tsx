'use client';

import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Locale } from '@hypha-platform/i18n';
import {
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import {
  listMemberHomeThreadItems,
  type MemberIntelligence,
  type NetworkHorizon,
} from '@hypha-platform/core/client';

import { getProposalPath, getSignalPath } from '../../common/get-path-function';
import type { SignupOrientation } from './signup-flow';
import { SpaceSwitcherOption } from '../../spaces/components/space-switcher-option';
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';
import { requestMemberHomeAsk } from './member-home-ask';
import { MemberHomeChat } from './member-home-chat';
import { MemberHomeThreadCard } from './member-home-thread-card';
import { MemberHomeMark } from './member-home-mark';
import { MemberHomeQuickCreate } from './member-home-quick-create';
import { MemberHomeHorizon } from './member-home-horizon';
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
  isSavingHorizon?: boolean;
  horizonError?: string | null;
  onChooseHorizon?: (horizon: NetworkHorizon) => void;
};

const ORIENTATIONS: SignupOrientation[] = ['member', 'builder', 'investor'];

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
  isSavingHorizon,
  horizonError,
  onChooseHorizon,
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
  const rawOrientation = home?.person.primaryOrientation;
  const orientation = isSignupOrientation(rawOrientation)
    ? rawOrientation
    : null;
  const displayName =
    home?.person.name?.trim() ||
    home?.person.nickname?.trim() ||
    greetingName?.trim() ||
    t('fallbackName');
  const tTypes = useTranslations('CoherenceTab');
  const lead = home?.attention[0];
  const leadItem = useMemo(() => {
    if (!home || !lead?.targetSlug) return null;
    return (
      listMemberHomeThreadItems(home).find(
        (item) => item.kind === lead.kind && item.slug === lead.targetSlug,
      ) ?? null
    );
  }, [home, lead]);
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
  const leadHref = lead
    ? lead.kind === 'proposal'
      ? getProposalPath(lang, lead.spaceSlug, lead.targetSlug)
      : getSignalPath(lang, lead.spaceSlug, lead.targetSlug)
    : null;

  return (
    <div className="relative isolate flex min-h-[calc(100dvh-4.5rem)] w-full flex-col lg:grid lg:h-[calc(100dvh-4.5rem)] lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)_minmax(17rem,22rem)] lg:overflow-hidden">
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
        className="order-2 max-h-[36rem] overflow-y-auto border-t border-border px-4 py-4 lg:order-none lg:col-start-1 lg:row-start-1 lg:max-h-none lg:border-r lg:border-t-0"
      >
        {home && home.invites.length > 0 ? (
          <div className="mb-4">
            <Tile title={t('invites')}>
              <ResourceList
                empty=""
                items={home.invites.map((invite) => ({
                  id: invite.id,
                  title: invite.spaceTitle,
                  detail: t('inviteDetail'),
                  href: `/${lang}/dho/${
                    invite.spaceSlug
                  }/overview?invite=${encodeURIComponent(invite.token)}`,
                }))}
              />
            </Tile>
          </div>
        ) : null}
        <MemberHomeSpacesWidget lang={lang} busy={home == null}>
          {home == null ? (
            <CardSkeleton />
          ) : home.spaces.length === 0 ? (
            <p className="text-2 text-neutral-11">{t('noSpaces')}</p>
          ) : (
            <ul className="grid">
              {home.spaces.map((space) => (
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
                  ? home.notifications.map((item) => ({
                      id: item.id,
                      title: item.title,
                      detail: item.detail,
                      href:
                        item.kind === 'signal'
                          ? `/${lang}/dho/${
                              item.spaceSlug
                            }?signal=${encodeURIComponent(item.targetSlug)}`
                          : getProposalPath(
                              lang,
                              item.spaceSlug,
                              item.targetSlug,
                            ),
                    }))
                  : []
              }
            />
            {home && home.notifications.length > 5 ? (
              <TileLink href={`/${lang}/my-spaces/notification-centre`}>
                {t('seeMoreNotifications')}
              </TileLink>
            ) : null}
          </Tile>
        </div>
      </aside>
      <main className="order-1 flex min-h-[70vh] min-w-0 flex-col lg:order-none lg:col-start-2 lg:row-start-1 lg:min-h-0 lg:overflow-hidden">
        <div className="border-b border-border px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="flex min-w-0 items-center gap-3">
              <MemberHomeMark className="h-9 w-9" />
              <div className="min-w-0">
                <h1
                  className="truncate text-4 leading-tight font-medium tracking-[-0.03em]"
                  style={{ fontFamily: 'var(--font-family-heading)' }}
                >
                  {t(greetingKey(), { name: displayName })}
                </h1>
                {home == null ? (
                  <Skeleton
                    loading
                    height="16px"
                    width="14rem"
                    className="mt-1"
                  />
                ) : (
                  <>
                    <p className="mt-1 text-1 tracking-[0.16em] text-neutral-11 uppercase">
                      {home.counts.connections > 0
                        ? t('peopleAround', { count: home.counts.connections })
                        : t('peopleAroundEmpty')}
                    </p>
                    {onChooseHorizon ? (
                      <MemberHomeHorizon
                        horizon={
                          home.networkHorizon === 'network'
                            ? 'network'
                            : 'spaces'
                        }
                        isSaving={isSavingHorizon}
                        error={horizonError}
                        onChoose={onChooseHorizon}
                      />
                    ) : null}
                  </>
                )}
              </div>
            </div>
            {home ? (
              <MemberHomeClosest
                lang={lang}
                people={home.connections}
                peopleCount={home.counts.connections}
                fallbackName={memberFallback}
                onOpenChat={openChat}
              />
            ) : (
              <div className="flex gap-2" aria-hidden>
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton
                    key={index}
                    loading
                    height="32px"
                    width="32px"
                    className="rounded-full"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        {home ? (
          <MemberHomeChat
            lang={lang}
            intelligence={home}
            onChatPerson={openChat}
            onCallPerson={openCall}
          />
        ) : (
          <div className="flex-1 px-4 py-6">
            <CardSkeleton lines={4} />
          </div>
        )}
      </main>
      <aside
        aria-label={t('panelInsights')}
        className="order-3 max-h-[36rem] overflow-y-auto border-t border-border px-4 py-4 lg:order-none lg:col-start-3 lg:row-start-1 lg:max-h-none lg:border-l lg:border-t-0"
      >
        {home == null ? (
          <Skeleton loading height="22px" width="7.5rem" className="mt-3" />
        ) : orientation == null ? (
          <section className="mt-10 border border-border bg-background/80 p-5">
            <h2
              className="text-4"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {t('chooseTitle')}
            </h2>
            <p className="mt-2 max-w-[48ch] text-2 leading-relaxed text-neutral-11">
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
              <p className="mt-3 text-2 text-error-11" role="alert">
                {orientationError}
              </p>
            ) : null}
          </section>
        ) : (
          <OrientationBadge
            orientation={orientation}
            isSaving={isSavingOrientation}
            error={orientationError}
            onChoose={onChooseOrientation}
          />
        )}

        <section
          className="mt-10 border border-border bg-background/85 p-5"
          aria-busy={home == null || undefined}
        >
          <div className="flex items-baseline justify-between gap-4">
            <h2
              className="text-4"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {home && !lead ? t('quietHeading') : t('useful')}
            </h2>
            {lead ? (
              <p className="text-1 tracking-[0.12em] text-neutral-11 uppercase">
                {lead.detail}
              </p>
            ) : null}
          </div>
          {home == null ? (
            <div className="mt-4">
              <CardSkeleton lines={3} />
            </div>
          ) : leadItem && home ? (
            <div className="mt-4">
              <MemberHomeThreadCard
                lang={lang}
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
          ) : lead ? (
            <div className="mt-4">
              <p className="text-3">{lead.title}</p>
              <p className="mt-1 text-2 text-neutral-11">{lead.detail}</p>
              {leadHref ? (
                <Button asChild className="mt-4">
                  <Link href={leadHref}>
                    {lead.kind === 'proposal' ? t('weighIn') : t('viewSignal')}
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
                  <span className="block text-2 font-medium">
                    {t('quietActivate')}
                  </span>
                  <span className="mt-1 block text-1 leading-relaxed text-neutral-11">
                    {t('quietActivateBody')}
                  </span>
                </Link>
              ) : (
                <Link
                  href={`/${lang}/my-spaces/create`}
                  className="border border-border bg-background px-4 py-3 text-foreground hover:border-foreground"
                >
                  <span className="block text-2 font-medium">
                    {t('createSpace')}
                  </span>
                  <span className="mt-1 block text-1 leading-relaxed text-neutral-11">
                    {t('quietCreateBody')}
                  </span>
                </Link>
              )}
            </div>
          )}
          {home && lead ? (
            <p className="mt-4 max-w-[52ch] text-2 leading-relaxed text-neutral-12">
              {home.guidance.narrative}
            </p>
          ) : null}
        </section>

        <dl className="mt-8 grid grid-cols-2 gap-px bg-border sm:grid-cols-[repeat(4,minmax(0,1fr))]">
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

        <div className="mt-8 grid gap-4">
          <MemberHomeWalletWidget
            lang={lang}
            personSlug={home?.person.slug}
            hasAddress={Boolean(home?.wallet.address)}
            isHomeLoading={home == null}
          />
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

        <div className="mt-4 grid gap-4">
          {home ? (
            <MemberHomeQuickCreate lang={lang} spaces={home.spaces} />
          ) : null}
          <Tile title={t('signals')} busy={home == null}>
            <ResourceList
              isLoading={home == null}
              empty={t('noSignals')}
              items={
                home
                  ? home.signals.flatMap((signal) =>
                      signal.slug
                        ? [
                            {
                              id: signal.id,
                              title: signal.title,
                              detail: [
                                tTypes.has(
                                  `types.${signal.type}` as 'types.Need',
                                )
                                  ? tTypes(
                                      `types.${signal.type}` as 'types.Need',
                                    )
                                  : signal.type,
                                signal.spaceTitle,
                              ]
                                .filter(Boolean)
                                .join(' · '),
                              href: getSignalPath(
                                lang,
                                signal.spaceSlug,
                                signal.slug,
                              ),
                            },
                          ]
                        : [],
                    )
                  : []
              }
            />
          </Tile>
          <Tile title={t('proposals')} busy={home == null}>
            <ResourceList
              isLoading={home == null}
              empty={t('noProposals')}
              items={
                home
                  ? home.proposals.flatMap((proposal) =>
                      proposal.slug
                        ? [
                            {
                              id: proposal.id,
                              title: proposal.title,
                              detail: `${proposal.spaceTitle} · ${
                                proposal.state ?? ''
                              }`,
                              href: getProposalPath(
                                lang,
                                proposal.spaceSlug,
                                proposal.slug,
                              ),
                            },
                          ]
                        : [],
                    )
                  : []
              }
            />
          </Tile>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href={`/${lang}/my-spaces/create`}>{t('createSpace')}</Link>
          </Button>
        </div>

        {orientation === 'builder' ? (
          <PersonaCard
            title={t('builderTitle')}
            body={t('builderBody')}
            action={t('builderAction')}
            href={`/${lang}/onboarding`}
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
      </aside>
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
    <div className="mt-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={isSaving}
            aria-label={t('changeOrientationLabel', { orientation: label })}
            className="inline-flex items-center gap-2 rounded-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
          >
            <Badge
              size={1}
              variant="outline"
              colorVariant="neutral"
              className="border-foreground/80 bg-background text-foreground hover:border-foreground hover:bg-neutral-3 hover:text-foreground"
            >
              {label}
            </Badge>
            <span className="text-1 font-medium tracking-[0.12em] text-neutral-11 uppercase">
              {t('changeOrientation')}
            </span>
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
                  <span className="block text-2 font-medium text-foreground">
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
        <p className="mt-3 text-2 text-error-11" role="alert">
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

function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          loading
          height="16px"
          width={CARD_SKELETON_WIDTHS[index] ?? '70%'}
        />
      ))}
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
    <div className="min-w-0 overflow-hidden bg-background px-3 py-4">
      <dt className="text-1 leading-tight tracking-[0.08em] text-neutral-11 uppercase">
        {label}
      </dt>
      <dd
        className="mt-2 text-4 leading-none tabular-nums"
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
      className="flex flex-col border border-border bg-background/80 p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          className="text-3"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {title}
        </h2>
        {count != null ? (
          <p className="text-2 tabular-nums text-neutral-11">{count}</p>
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
      className="mt-4 inline-block text-2 text-accent-11 underline-offset-4 hover:underline"
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
  }>;
  empty: string;
  isLoading?: boolean;
  maxItems?: number;
}) {
  if (isLoading) return <CardSkeleton />;
  if (items.length === 0) {
    return <p className="text-2 text-neutral-11">{empty}</p>;
  }
  return (
    <ul className="grid gap-3">
      {items.slice(0, maxItems).map((item) => (
        <li key={item.id}>
          <Link href={item.href} className="group block">
            <span className="block text-2 group-hover:underline">
              {item.title}
            </span>
            {item.detail ? (
              <span className="mt-0.5 block text-1 text-neutral-11 line-clamp-2">
                {item.detail}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
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
    <section className="mt-4 border border-border bg-accent-2 p-5">
      <h2
        className="text-4"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {title}
      </h2>
      <p className="mt-2 max-w-[52ch] text-2 leading-relaxed text-neutral-11">
        {body}
      </p>
      {meta ? <p className="mt-2 text-1 text-neutral-11">{meta}</p> : null}
      <Button asChild className="mt-4">
        <Link href={href}>{action}</Link>
      </Button>
    </section>
  );
}
