'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import type { MemberHomeThreadItem } from '@hypha-platform/core/client';
import type { MemberIntelligence } from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { Button } from '@hypha-platform/ui';

import { getProposalPath, getSignalPath } from '../../common/get-path-function';
import { SpaceSwitcherMark } from '../../spaces/components/space-switcher-option';
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';
import { celebrate } from './member-home-celebrate';
import { MemberHomeVote } from './member-home-vote';

type MemberHomeThreadCardProps = {
  lang: Locale;
  item: MemberHomeThreadItem;
  proposal: MemberIntelligence['proposals'][number] | null;
  onValidate: (title: string) => void;
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

export function MemberHomeThreadCard({
  lang,
  item,
  proposal,
  onValidate,
}: MemberHomeThreadCardProps) {
  const t = useTranslations('MemberHome');
  const { resolvedTheme } = useTheme();
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

  return (
    <section className="max-w-[46ch] border border-border bg-background-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-1 tracking-[0.12em] text-neutral-11 uppercase">
          {kindLabel(item.documentKind, t)}
        </p>
        <p className="flex min-w-0 items-center gap-2 text-1 tracking-[0.12em] text-neutral-11 uppercase">
          <SpaceSwitcherMark iconUrl={spaceIconUrl} />
          <span className="min-w-0 truncate">{item.spaceTitle}</span>
        </p>
      </div>
      <h2
        className="mt-2 text-4"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {item.title}
      </h2>
      {item.authoredByMember ? (
        <p className="mt-2 text-1 text-neutral-11">{t('proposedByYou')}</p>
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
        {isSignal ? (
          <Button
            type="button"
            onClick={() => {
              celebrate();
              onValidate(item.title);
            }}
          >
            {t('validate')}
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href={visitHref}>{t('visitSpace')}</Link>
        </Button>
        {isSignal ? (
          <Button asChild variant="outline">
            <Link href={getSignalPath(lang, item.spaceSlug, item.slug)}>
              {t('viewSignal')}
            </Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
