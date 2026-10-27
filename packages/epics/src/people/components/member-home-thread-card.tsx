'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import {
  memberHomeSignalCtas,
  memberHomeThreadItemKey,
  type MemberHomeSignalCta,
  type MemberHomeThreadItem,
} from '@hypha-platform/core/client';
import type { MemberIntelligence } from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import { getProposalPath, getSignalPath } from '../../common/get-path-function';
import { useHumanChatPanel } from '../../common/human-chat-panel-context';
import { SpaceSwitcherMark } from '../../spaces/components/space-switcher-option';
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';
import { celebrate } from './member-home-celebrate';
import {
  HOME_QUEUE_EVENT,
  homeReturnText,
  markHomeActed,
  readHomeActed,
  rememberHomeAction,
} from './member-home-resume';
import { MemberHomeProposalBody } from './member-home-proposal-body';
import { PersonAvatar } from './person-avatar';
import { SentTick } from './member-home-sent-tick';
import './member-home-banner.css';

/** The tick mark finishes just after 900ms. Let it sit, then ask for the next item. */
const TICK_THEN_NEXT_MS = 1100;

const SIGNAL_TYPES = [
  'Need',
  'Resource',
  'Opportunity',
  'Insight',
  'Tension',
  'Risk',
  'Action',
  'Impact',
  'Trend',
  'Proposal',
] as const;

type ReachPerson = {
  id: number;
  slug: string | null;
  name: string | null;
  surname: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  spaceSlug?: string | null;
};

type MemberHomeThreadCardProps = {
  lang: Locale;
  item: MemberHomeThreadItem;
  proposal: MemberIntelligence['proposals'][number] | null;
  onAsk: (text: string, hidden?: boolean) => void;
  /** The tick is on screen. Stop the current voice line before the next item. */
  onSettled?: () => void;
  onReach: (person: ReachPerson, mode: 'call' | 'chat') => Promise<boolean>;
  /** Side panel uses the spaces-tile scale. The conversation card stays larger. */
  compact?: boolean;
  /** The AI chat card. Shorter banner, tighter type, one glance at the vote. */
  chat?: boolean;
  /** Classic home keeps the card and drops every line that would talk to the AI. */
  assistant?: boolean;
  /** Classic lead card: title opens the item, picture sits beside the text. */
  board?: boolean;
  /**
   * The member already acted. The card stays in the thread with a tick
   * instead of leaving when the live queue moves on.
   */
  done?: boolean;
};

function kindLabel(
  documentKind: string,
  t: ReturnType<typeof useTranslations<'MemberHome'>>,
) {
  const normalized = documentKind.trim().toLowerCase();
  if (normalized === 'proposal') return t('kindProposal');
  if (normalized === 'signal') return t('kindSignal');
  if (normalized === 'discussion') return t('kindDiscussion');
  if (normalized === 'agreement') return t('kindAgreement');
  return documentKind.trim();
}

function givenName(name: string | null | undefined) {
  const first = name?.trim().split(/\s+/)[0];
  return first || '';
}

function plainSummary(value: string) {
  return value
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[*_`>#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalType(type: string | null) {
  if (!type) return null;
  const trimmed = type.trim();
  return (
    SIGNAL_TYPES.find((item) => item.toLowerCase() === trimmed.toLowerCase()) ??
    trimmed
  );
}

export function MemberHomeThreadCard({
  lang,
  item,
  proposal,
  onAsk,
  onSettled,
  onReach,
  compact = false,
  chat = false,
  assistant = true,
  board = false,
  done = false,
}: MemberHomeThreadCardProps) {
  const t = useTranslations('MemberHome');
  const tTypes = useTranslations('CoherenceTab');
  const router = useRouter();
  const { openCoherenceChat, openHumanChatPanel } = useHumanChatPanel();
  const { resolvedTheme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [kept, setKept] = useState(false);
  const held = useRef(false);
  const continued = useRef(false);
  const continueTimer = useRef<number | null>(null);
  const itemTitleRef = useRef(item.title);
  itemTitleRef.current = item.title;
  const onAskRef = useRef(onAsk);
  const onSettledRef = useRef(onSettled);
  onAskRef.current = onAsk;
  onSettledRef.current = onSettled;
  // Local keep paints the tick before storage catches up.
  const complete = done || kept;

  useEffect(() => {
    return () => {
      if (continueTimer.current != null) {
        window.clearTimeout(continueTimer.current);
      }
    };
  }, []);

  function beginNextAfterTick(text: string) {
    if (continued.current || !assistant) return;
    continued.current = true;
    onSettledRef.current?.();
    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    continueTimer.current = window.setTimeout(
      () => {
        onAskRef.current(text, true);
      },
      reduce ? 200 : TICK_THEN_NEXT_MS,
    );
  }

  function settleWithoutNext() {
    continued.current = true;
    onSettledRef.current?.();
  }

  const itemKey = memberHomeThreadItemKey(item);
  useEffect(() => {
    if (!assistant) return;
    // Storage already knows this one. Loading the thread must not ask again.
    let already = readHomeActed().includes(itemKey);
    const onActed = () => {
      if (already || continued.current) return;
      if (!readHomeActed().includes(itemKey)) return;
      already = true;
      beginNextAfterTick(homeReturnText(itemTitleRef.current));
    };
    window.addEventListener(HOME_QUEUE_EVENT, onActed);
    return () => window.removeEventListener(HOME_QUEUE_EVENT, onActed);
  }, [assistant, itemKey]);
  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';
  const spaceIconUrl = resolveSpaceDisplayLogoUrl(
    item.spaceLogo ?? proposal?.spaceLogo,
    logoVariant,
  );
  const isSignal = item.kind === 'signal' || item.documentKind === 'signal';
  const isProposal = !isSignal && item.documentKind === 'proposal';
  const signalHref = getSignalPath(lang, item.spaceSlug, item.slug);
  const proposalSlug = proposal?.slug || item.slug;
  const visitHref = isSignal
    ? signalHref
    : proposalSlug
    ? getProposalPath(lang, item.spaceSlug, proposalSlug)
    : `/${lang}/dho/${item.spaceSlug}/agreements`;
  const typeName = canonicalType(item.category);
  const typeKey = typeName ? (`types.${typeName}` as never) : null;
  const categoryLabel =
    typeKey && tTypes.has(typeKey) ? tTypes(typeKey) : typeName;
  const eyebrow = isSignal
    ? categoryLabel || t('kindSignal')
    : item.category?.trim() || kindLabel(item.documentKind, t);
  const creator =
    item.creatorId != null && item.creatorName && !item.authoredByMember
      ? {
          id: item.creatorId,
          slug: null,
          name: item.creatorName,
          surname: null,
          nickname: null,
          avatarUrl: item.creatorAvatarUrl,
          spaceSlug: item.spaceSlug,
        }
      : null;
  const seededOutcome =
    item.action === 'outcome' &&
    typeof item.participation === 'number' &&
    typeof item.unity === 'number'
      ? {
          passed: item.passed === true,
          participation: item.participation,
          unity: item.unity,
        }
      : null;
  const [liveOutcome, setLiveOutcome] = useState(seededOutcome);
  const rememberOutcome = useCallback(
    (next: { passed: boolean; participation: number; unity: number }) => {
      setLiveOutcome((current) => {
        if (
          current?.passed === next.passed &&
          current.participation === next.participation &&
          current.unity === next.unity
        ) {
          return current;
        }
        return next;
      });
    },
    [],
  );
  const outcome = liveOutcome ?? seededOutcome;
  const ownDeadline = isSignal && item.authoredByMember;
  const ctas = (
    ownDeadline
      ? []
      : isSignal
      ? memberHomeSignalCtas({
          category: item.category,
          hasCreator: creator != null,
        })
      : []
  ).filter((cta) => assistant || cta === 'discuss' || cta === 'call');

  function confirm(id: string) {
    if (held.current) return false;
    held.current = true;
    setChosen(id);
    setBusy(true);
    celebrate();
    window.setTimeout(() => {
      held.current = false;
      setBusy(false);
    }, 400);
    return true;
  }

  function ask(text: string) {
    onAsk(text);
  }

  function noteAction() {
    setKept(true);
    settleWithoutNext();
    rememberHomeAction(memberHomeThreadItemKey(item), item.title);
  }

  /** A signal has nothing to decide. The click moves the thread to the next item. */
  function moveOn(leaves: boolean) {
    if (!assistant || !isSignal) return;
    const key = memberHomeThreadItemKey(item);
    setKept(true);
    if (leaves) {
      settleWithoutNext();
      rememberHomeAction(key, item.title);
      return;
    }
    beginNextAfterTick(homeReturnText(item.title));
    markHomeActed(key);
  }

  async function reach(mode: 'call' | 'chat') {
    if (!creator || busy) return;
    if (!(assistant && isSignal)) noteAction();
    setBusy(true);
    const opened = await onReach(creator, mode);
    if (!opened && mode === 'call' && assistant && !isSignal) {
      onAsk(t('callFallback', { name: creator.name ?? '', title: item.title }));
    }
    setBusy(false);
  }

  function labelFor(cta: MemberHomeSignalCta) {
    const name = creator?.name ?? t('fallbackMember');
    switch (cta) {
      case 'help':
        return t('helpWithThis');
      case 'share':
        return t('shareThis');
      case 'take':
        return t('takeThis');
      case 'impact':
        return t('seeImpact');
      case 'discuss':
        return t('discussThis');
      case 'call':
        return t('callCreator', { name: givenName(name) || name });
      case 'context':
        return t('askContext');
      case 'later':
        return t('notNow');
    }
  }

  function onCta(cta: MemberHomeSignalCta) {
    switch (cta) {
      case 'help':
      case 'share':
      case 'take':
      case 'impact':
      case 'context':
        if (isSignal) {
          moveOn(false);
          return;
        }
        ask(t('helpChosen', { title: item.title }));
        return;
      case 'later':
        ask(t('laterChosen', { title: item.title }));
        return;
      case 'call':
        if (isSignal) moveOn(false);
        void reach('call');
        return;
      case 'discuss': {
        const slug = item.slug.trim();
        if (!slug) return;
        const roomId = item.roomId?.trim() || null;
        if (isSignal) moveOn(!roomId);
        else noteAction();
        if (roomId) {
          openCoherenceChat(
            roomId,
            item.title,
            slug,
            item.summary,
            item.spaceSlug,
          );
          return;
        }
        openHumanChatPanel();
        router.push(signalHref);
        return;
      }
    }
  }

  const summary = item.summary ? plainSummary(item.summary) : '';
  const leadImage = proposal?.leadImage?.trim() ?? '';
  const actionClass = 'h-full w-full whitespace-normal';
  const primaryCtas = ctas.filter((cta) => cta !== 'later');
  const leadCta = primaryCtas[0] ?? null;
  const companionCta = primaryCtas[1] ?? null;

  function choiceProps(id: string, primary = false) {
    const picked = chosen === id;
    const filled = picked || (chosen == null && primary);
    const variant: 'default' | 'outline' = filled ? 'default' : 'outline';
    const colorVariant: 'accent' | 'neutral' = filled ? 'accent' : 'neutral';
    return {
      variant,
      colorVariant,
      className: cn(actionClass, picked && 'ring-1 ring-foreground'),
    };
  }

  return (
    <section
      className={cn(
        'member-home-thread-card w-full overflow-hidden',
        chat && 'member-home-thread-card--chat',
        board && leadImage && 'member-home-thread-card--board @container',
      )}
    >
      {leadImage ? (
        <img src={leadImage} alt="" className="member-home-thread-image" />
      ) : null}
      <div className={cn('member-home-thread-body', chat ? 'p-3' : 'p-4')}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-1 tracking-[0.12em] text-neutral-11 uppercase">
            {isProposal
              ? [
                  outcome ? t('voteClosed') : t('onVoting'),
                  item.category?.trim(),
                ]
                  .filter(Boolean)
                  .join(' · ')
              : eyebrow}
          </p>
          <p className="flex min-w-0 items-center gap-2 text-1 tracking-[0.12em] text-neutral-11 uppercase">
            <SpaceSwitcherMark iconUrl={spaceIconUrl} />
            <span className="min-w-0 truncate">{item.spaceTitle}</span>
          </p>
        </div>
        {board ? (
          <Link
            href={visitHref}
            className="group mt-3 inline-flex max-w-full items-baseline gap-2 text-foreground"
          >
            <h2
              className="min-w-0 text-4 group-hover:underline"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {item.title}
            </h2>
            <ArrowRight
              className="size-5 shrink-0 translate-y-0.5 opacity-45 group-hover:opacity-100"
              strokeWidth={1.5}
              aria-hidden
            />
          </Link>
        ) : (
          <h2
            className={
              chat ? 'mt-2 text-2' : compact ? 'mt-3 text-1' : 'mt-3 text-4'
            }
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {item.title}
          </h2>
        )}
        {creator ? (
          <div
            className={cn('flex items-center gap-2', chat ? 'mt-2' : 'mt-3')}
          >
            <PersonAvatar
              avatarSrc={creator.avatarUrl ?? undefined}
              userName={creator.name ?? undefined}
              size="sm"
              shape="circle"
              personId={creator.id}
            />
            <p
              className={
                compact ? 'min-w-0 truncate text-1' : 'min-w-0 truncate text-2'
              }
            >
              {isProposal
                ? t('proposedBy', { name: creator.name ?? '' })
                : creator.name}
            </p>
          </div>
        ) : item.authoredByMember && !isSignal ? (
          <p className="mt-3 text-1 text-neutral-11">{t('proposedByYou')}</p>
        ) : null}
        {ownDeadline ? (
          <p className="mt-3 text-2 leading-relaxed text-foreground">
            {t('ownDeadline')}
          </p>
        ) : null}
        {summary ? (
          <p
            className={
              chat
                ? 'mt-2 text-1 leading-relaxed text-neutral-12'
                : compact
                ? 'mt-3 text-1 leading-relaxed text-neutral-12'
                : 'mt-3 text-2 leading-relaxed text-neutral-12'
            }
          >
            {summary}
          </p>
        ) : null}
        {isProposal ? (
          <MemberHomeProposalBody
            proposalId={proposal?.web3ProposalId ?? item.web3ProposalId ?? null}
            spaceId={proposal?.web3SpaceId ?? item.web3SpaceId ?? null}
            documentId={proposal?.id ?? item.documentId ?? null}
            documentSlug={proposal?.slug ?? item.slug}
            compact={compact}
            chat={chat}
            settled={complete}
            onClosed={rememberOutcome}
          />
        ) : null}
        {outcome ? (
          <p
            className={
              chat
                ? 'mt-2 text-1 leading-relaxed text-foreground'
                : compact
                ? 'mt-3 text-1 leading-relaxed text-foreground'
                : 'mt-3 text-2 leading-relaxed text-foreground'
            }
          >
            {t(outcome.passed ? 'outcomePassed' : 'outcomeClosed', {
              participation: outcome.participation,
              unity: outcome.unity,
            })}
          </p>
        ) : null}
        <div className={cn('flex flex-col gap-2', chat ? 'mt-2' : 'mt-3')}>
          {complete ? (
            <div
              className="flex flex-col items-center px-2 py-4 text-center"
              aria-live="polite"
            >
              <SentTick />
              <p
                className={cn(
                  'mt-3 font-medium tracking-[-0.03em] text-foreground',
                  chat ? 'text-2' : 'text-3',
                )}
                style={{ fontFamily: 'var(--font-family-heading)' }}
              >
                {outcome
                  ? t('gotItDone')
                  : isProposal
                  ? t('threadCardVoted')
                  : t('threadCardNoted')}
              </p>
              <p className="mt-1 text-1 text-neutral-11">
                {t('threadCardKept')}
              </p>
            </div>
          ) : null}
          {!complete && outcome ? (
            <Button
              type="button"
              {...choiceProps('got-it', true)}
              disabled={chosen === 'got-it'}
              aria-live="polite"
              onClick={() => {
                if (!confirm('got-it')) return;
                const key = memberHomeThreadItemKey(item);
                const title = item.title;
                setKept(true);
                if (assistant) beginNextAfterTick(t('gotItChosen', { title }));
                markHomeActed(key);
              }}
            >
              {t('gotIt')}
            </Button>
          ) : null}
          {!complete && !outcome && ownDeadline ? (
            <Button asChild {...choiceProps('update', true)}>
              <Link
                href={signalHref}
                onClick={() => {
                  if (!confirm('update')) return;
                  moveOn(true);
                }}
              >
                {t('updateThis')}
              </Link>
            </Button>
          ) : null}
          {!complete && !outcome && leadCta ? (
            <Button
              type="button"
              {...choiceProps(leadCta, true)}
              onClick={() => {
                if (!confirm(leadCta)) return;
                onCta(leadCta);
              }}
            >
              {labelFor(leadCta)}
            </Button>
          ) : null}
          {!complete && !outcome && !isSignal && assistant ? (
            <div
              className={cn(
                'grid gap-2',
                compact || !creator ? 'grid-cols-1' : 'grid-cols-2',
              )}
            >
              {creator ? (
                <Button
                  type="button"
                  {...choiceProps('ask', true)}
                  onClick={() => {
                    if (!confirm('ask')) return;
                    void reach('chat');
                  }}
                >
                  {t('askProposer', { name: givenName(creator.name) })}
                </Button>
              ) : null}
              <Button
                type="button"
                {...choiceProps('think', !creator)}
                onClick={() => {
                  if (!confirm('think')) return;
                  ask(
                    item.creatorName
                      ? t('thinkChosenBy', {
                          title: item.title,
                          space: item.spaceTitle,
                          name: item.creatorName,
                        })
                      : t('thinkChosen', {
                          title: item.title,
                          space: item.spaceTitle,
                        }),
                  );
                }}
              >
                {t('helpMeThink')}
              </Button>
            </div>
          ) : null}
          {!complete && !outcome && (companionCta || assistant) ? (
            <div
              className={cn(
                'grid gap-2',
                compact || !(companionCta && assistant)
                  ? 'grid-cols-1'
                  : 'grid-cols-2',
              )}
            >
              {companionCta ? (
                <Button
                  type="button"
                  {...choiceProps(companionCta)}
                  onClick={() => {
                    if (!confirm(companionCta)) return;
                    onCta(companionCta);
                  }}
                >
                  {labelFor(companionCta)}
                </Button>
              ) : null}
              {assistant ? (
                <Button
                  type="button"
                  {...choiceProps('later')}
                  onClick={() => {
                    if (!confirm('later')) return;
                    ask(t('laterChosen', { title: item.title }));
                  }}
                >
                  {t('notNow')}
                </Button>
              ) : null}
            </div>
          ) : null}
          {!complete ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {!outcome && assistant ? (
                <button
                  type="button"
                  className="text-1 text-neutral-11 underline-offset-2 hover:text-foreground hover:underline"
                  onClick={() => {
                    if (!confirm('no')) return;
                    ask(t('noChosen', { title: item.title }));
                  }}
                >
                  {t('noThanks')}
                </button>
              ) : null}
              <Link
                href={visitHref}
                onClick={() => {
                  if (isSignal) moveOn(true);
                  else noteAction();
                }}
                className="text-1 text-neutral-11 underline-offset-2 hover:text-foreground hover:underline"
              >
                {t('visitSpace')}
              </Link>
            </div>
          ) : (
            <div className="flex justify-center">
              <Link
                href={visitHref}
                className="text-1 text-neutral-11 underline-offset-2 hover:text-foreground hover:underline"
              >
                {t('visitSpace')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
