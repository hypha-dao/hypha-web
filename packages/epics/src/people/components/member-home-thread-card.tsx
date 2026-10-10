'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import {
  memberHomeSignalCtas,
  type MemberHomeSignalCta,
  type MemberHomeThreadItem,
} from '@hypha-platform/core/client';
import type { MemberIntelligence } from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { Button } from '@hypha-platform/ui';

import { getProposalPath, getSignalPath } from '../../common/get-path-function';
import { SpaceSwitcherMark } from '../../spaces/components/space-switcher-option';
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';
import { celebrate } from './member-home-celebrate';
import { MemberHomeVote } from './member-home-vote';
import { PersonAvatar } from './person-avatar';

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
};

type MemberHomeThreadCardProps = {
  lang: Locale;
  item: MemberHomeThreadItem;
  proposal: MemberIntelligence['proposals'][number] | null;
  onAsk: (text: string) => void;
  onReach: (person: ReachPerson, mode: 'call' | 'chat') => Promise<boolean>;
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
}: MemberHomeThreadCardProps) {
  const t = useTranslations('MemberHome');
  const tTypes = useTranslations('CoherenceTab');
  const { resolvedTheme } = useTheme();
  const [busy, setBusy] = useState(false);
  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';
  const spaceIconUrl = resolveSpaceDisplayLogoUrl(
    item.spaceLogo ?? proposal?.spaceLogo,
    logoVariant,
  );
  const isSignal = item.kind === 'signal' || item.documentKind === 'signal';
  const canVote =
    !isSignal &&
    item.documentKind === 'proposal' &&
    proposal?.web3ProposalId != null;
  const visitHref = isSignal
    ? `/${lang}/dho/${item.spaceSlug}/overview`
    : proposal?.slug
    ? getProposalPath(lang, item.spaceSlug, proposal.slug)
    : item.slug
    ? getProposalPath(lang, item.spaceSlug, item.slug)
    : `/${lang}/dho/${item.spaceSlug}/agreements`;
  const signalHref = getSignalPath(lang, item.spaceSlug, item.slug);
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
        }
      : null;
  const ctas = isSignal
    ? memberHomeSignalCtas({
        category: item.category,
        hasCreator: creator != null,
      })
    : [];

  function ask(text: string, sound = false) {
    if (busy) return;
    setBusy(true);
    if (sound) celebrate();
    onAsk(text);
    window.setTimeout(() => setBusy(false), 400);
  }

  async function reach(mode: 'call' | 'chat') {
    if (!creator || busy) return;
    setBusy(true);
    const opened = await onReach(creator, mode);
    if (!opened) {
      onAsk(
        mode === 'call'
          ? t('callFallback', { name: creator.name ?? '', title: item.title })
          : t('askProposerChosen', {
              name: creator.name ?? '',
              title: item.title,
            }),
      );
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
        return t('callCreator', { name });
      case 'context':
        return t('askContext');
      case 'later':
        return t('notNow');
    }
  }

  function onCta(cta: MemberHomeSignalCta) {
    switch (cta) {
      case 'help':
        ask(t('helpChosen', { title: item.title }), true);
        return;
      case 'share':
        ask(t('shareChosen', { title: item.title }), true);
        return;
      case 'take':
        ask(t('takeChosen', { title: item.title }), true);
        return;
      case 'impact':
        ask(t('impactChosen', { title: item.title }));
        return;
      case 'context':
        ask(t('contextChosen', { title: item.title }));
        return;
      case 'later':
        ask(t('laterChosen', { title: item.title }));
        return;
      case 'call':
        void reach('call');
        return;
      case 'discuss':
        return;
    }
  }

  return (
    <section className="w-full border border-border bg-background-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-1 tracking-[0.12em] text-neutral-11 uppercase">
          {eyebrow}
        </p>
        <p className="flex min-w-0 items-center gap-2 text-1 tracking-[0.12em] text-neutral-11 uppercase">
          <SpaceSwitcherMark iconUrl={spaceIconUrl} />
          <span className="min-w-0 truncate">{item.spaceTitle}</span>
        </p>
      </div>
      {creator ? (
        <div className="mt-3 flex items-center gap-2">
          <PersonAvatar
            avatarSrc={creator.avatarUrl ?? undefined}
            userName={creator.name ?? undefined}
            size="sm"
            shape="circle"
          />
          <p className="min-w-0 truncate text-2">{creator.name}</p>
        </div>
      ) : null}
      <h2
        className="mt-2 text-4"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {item.title}
      </h2>
      {item.summary ? (
        <p className="mt-2 text-2 leading-relaxed text-neutral-12">
          {item.summary}
        </p>
      ) : null}
      {item.authoredByMember ? (
        <p className="mt-2 text-1 text-neutral-11">{t('proposedByYou')}</p>
      ) : creator && !isSignal ? (
        <p className="mt-2 text-1 text-neutral-11">
          {t('proposedBy', { name: creator.name ?? '' })}
        </p>
      ) : null}
      {canVote && proposal ? (
        <MemberHomeVote
          proposalId={proposal.web3ProposalId as number}
          documentId={proposal.id}
        />
      ) : null}
      {!isSignal && item.documentKind === 'proposal' && !canVote ? (
        <p className="mt-3 text-2 text-neutral-11">{t('voteNeedsChain')}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {ctas.map((cta, index) =>
          cta === 'discuss' ? (
            <Button
              key={cta}
              asChild
              variant={index === 0 ? 'default' : 'outline'}
              colorVariant={index === 0 ? 'accent' : 'neutral'}
            >
              <Link href={signalHref}>{labelFor(cta)}</Link>
            </Button>
          ) : (
            <Button
              key={cta}
              type="button"
              variant={index === 0 ? 'default' : 'outline'}
              colorVariant={index === 0 ? 'accent' : 'neutral'}
              disabled={busy}
              onClick={() => onCta(cta)}
            >
              {labelFor(cta)}
            </Button>
          ),
        )}
        {!isSignal && creator ? (
          <Button
            type="button"
            variant="outline"
            colorVariant="neutral"
            disabled={busy}
            onClick={() => {
              void reach('chat');
            }}
          >
            {t('askProposer', { name: creator.name ?? '' })}
          </Button>
        ) : null}
        {!isSignal ? (
          <Button
            type="button"
            variant="outline"
            colorVariant="neutral"
            disabled={busy}
            onClick={() => ask(t('thinkChosen', { title: item.title }))}
          >
            {t('helpMeThink')}
          </Button>
        ) : null}
        <Button asChild variant="outline" colorVariant="neutral">
          <Link href={visitHref}>{t('visitSpace')}</Link>
        </Button>
      </div>
    </section>
  );
}
