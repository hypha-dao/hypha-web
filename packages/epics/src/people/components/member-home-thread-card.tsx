'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  homeReturnText,
  markHomeActed,
  rememberHomeAction,
} from './member-home-resume';
import { MemberHomeProposalBody } from './member-home-proposal-body';
import { PersonAvatar } from './person-avatar';
import './member-home-banner.css';

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
  onReach: (person: ReachPerson, mode: 'call' | 'chat') => Promise<boolean>;
  /** Side panel uses the spaces-tile scale. The conversation card stays larger. */
  compact?: boolean;
  /** The AI chat card. Shorter banner, tighter type, one glance at the vote. */
  chat?: boolean;
  /** Classic home keeps the card and drops every line that would talk to the AI. */
  assistant?: boolean;
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
  onReach,
  compact = false,
  chat = false,
  assistant = true,
}: MemberHomeThreadCardProps) {
  const t = useTranslations('MemberHome');
  const tTypes = useTranslations('CoherenceTab');
  const router = useRouter();
  const { openCoherenceChat, openHumanChatPanel } = useHumanChatPanel();
  const { resolvedTheme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const held = useRef(false);
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
    rememberHomeAction(memberHomeThreadItemKey(item), item.title);
  }

  /** A signal has nothing to decide. The click moves the thread to the next item. */
  function moveOn(leaves: boolean) {
    if (!assistant || !isSignal) return;
    const key = memberHomeThreadItemKey(item);
    if (leaves) {
      rememberHomeAction(key, item.title);
      return;
    }
    markHomeActed(key);
    onAsk(homeReturnText(item.title), true);
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
  const actionClass = compact ? 'w-full' : 'w-fit';
  const primaryCtas = ctas.filter((cta) => cta !== 'later');

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
      )}
    >
      {leadImage ? (
        <img src={leadImage} alt="" className="member-home-thread-image" />
      ) : null}
      <div className={chat ? 'p-3' : 'p-4'}>
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
        <h2
          className={
            chat ? 'mt-2 text-2' : compact ? 'mt-3 text-1' : 'mt-3 text-4'
          }
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {item.title}
        </h2>
        {creator ? (
          <div
            className={cn('flex items-center gap-2', chat ? 'mt-2' : 'mt-3')}
          >
            <PersonAvatar
              avatarSrc={creator.avatarUrl ?? undefined}
              userName={creator.name ?? undefined}
              size="sm"
              shape="circle"
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
                ? 'mt-2 line-clamp-2 text-1 leading-relaxed text-neutral-12'
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
        <div
          className={
            chat
              ? 'mt-2 flex flex-wrap items-center gap-2'
              : compact
              ? 'mt-3 grid w-full grid-cols-1 gap-2'
              : 'mt-3 flex flex-wrap items-center gap-2'
          }
        >
          {outcome ? (
            <Button
              type="button"
              {...choiceProps('got-it', true)}
              onClick={() => {
                if (!confirm('got-it')) return;
                markHomeActed(memberHomeThreadItemKey(item));
                if (!assistant) return;
                onAsk(
                  `I have the outcome on "${item.title}". Continue with the next.`,
                  true,
                );
              }}
            >
              {t('gotIt')}
            </Button>
          ) : null}
          {!outcome && ownDeadline ? (
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
          {!outcome &&
            primaryCtas.map((cta, index) => (
              <Button
                key={cta}
                type="button"
                {...choiceProps(cta, index === 0)}
                onClick={() => {
                  if (!confirm(cta)) return;
                  onCta(cta);
                }}
              >
                {labelFor(cta)}
              </Button>
            ))}
          {!outcome && assistant && !isSignal && creator ? (
            <Button
              type="button"
              {...choiceProps('ask')}
              onClick={() => {
                if (!confirm('ask')) return;
                void reach('chat');
              }}
            >
              {t('askProposer', { name: givenName(creator.name) })}
            </Button>
          ) : null}
          {!outcome && assistant && !isSignal ? (
            <Button
              type="button"
              {...choiceProps('think')}
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
          ) : null}
          {!outcome && assistant ? (
            <div
              className={
                compact
                  ? 'contents'
                  : 'flex max-w-full flex-wrap items-center gap-2'
              }
            >
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
              <Button
                type="button"
                {...choiceProps('no')}
                onClick={() => {
                  if (!confirm('no')) return;
                  ask(t('noChosen', { title: item.title }));
                }}
              >
                {t('noThanks')}
              </Button>
            </div>
          ) : null}
          {!isProposal ? (
            <Button asChild {...choiceProps('visit')}>
              <Link
                href={visitHref}
                onClick={() => {
                  if (!confirm('visit')) return;
                  if (isSignal) moveOn(true);
                  else noteAction();
                }}
              >
                {t('visitSpace')}
              </Link>
            </Button>
          ) : null}
        </div>
        {isProposal ? (
          <Link
            href={visitHref}
            onClick={noteAction}
            className="mt-3 inline-block text-1 text-neutral-11 underline-offset-2 hover:underline"
          >
            {t('visitSpace')}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
