'use client';

import {
  officialSectionMarkdown,
  splitLeadParagraph,
  stripMatchingLeadingHeading,
  useProposalDetailsWeb3Rpc,
  type BuiltinSpaceContextSectionKey,
  type SpaceContextSectionKey,
  type SpaceContextSectionRecord,
} from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { Button, Card, CardTitle } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import {
  InlineText,
  MemoryProse,
} from '../../coherence/components/memory-prose';
import { getProposalPath } from '../../common/get-path-function';
import { agreementNumber } from './agreement-number';
import {
  SpaceContextChangeBadge,
  SpaceContextStatusChip,
} from './space-context-status-chip';

export type SpaceContextT = ReturnType<typeof useTranslations<'SpaceContext'>>;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export function SpaceContextCard({
  section,
  spaceSlug,
  selected,
  featured,
  canMutate,
  onRead,
  onOpen,
  onProposeAmendment,
}: {
  section: SpaceContextSectionRecord;
  spaceSlug: string;
  selected?: boolean;
  featured?: boolean;
  canMutate: boolean;
  onRead: (key: SpaceContextSectionKey) => void;
  onOpen: (key: SpaceContextSectionKey) => void;
  onProposeAmendment?: (key: SpaceContextSectionKey) => void;
}) {
  const t = useTranslations('SpaceContext');
  const locale = useLocale() as Locale;
  const title = section.title;
  const official = officialSectionMarkdown(section);
  const unofficial = official == null;
  const body = stripMatchingLeadingHeading(official ?? section.markdown, title);
  const empty = !body.trim();
  const { lead, rest } = splitLeadParagraph(body);
  const proposalHref =
    section.status === 'proposed' && section.proposalSlug
      ? getProposalPath(locale, spaceSlug, section.proposalSlug)
      : null;
  const agreementHref = section.ratifiedSlug
    ? getProposalPath(locale, spaceSlug, section.ratifiedSlug)
    : null;
  const notice = sectionNotice(section, t);

  return (
    <Card
      className={cn(
        'relative flex h-full flex-col transition-colors hover:border-neutral-11',
        featured
          ? 'gap-2.5 border-success-11 px-6 pb-[18px] pt-5'
          : 'min-h-[210px] gap-3.5 p-6',
        selected && 'border-foreground',
        (unofficial || section.pendingChange) && 'border-dashed',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <CardTitle
            className={cn(
              'font-semibold',
              featured ? 'text-5' : 'flex-1 text-[17px]',
            )}
          >
            <button
              type="button"
              className="text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-1 focus-visible:after:ring-ring"
              onClick={() => onRead(section.sectionKey)}
              aria-label={t('card.read', { section: title })}
            >
              {title}
            </button>
          </CardTitle>
          {featured ? <SpaceContextStatusChip status={section.status} /> : null}
          <SpaceContextChangeBadge change={section.pendingChange} />
        </div>
        {featured ? (
          canMutate &&
          section.status !== 'proposed' &&
          !section.pendingChange &&
          onProposeAmendment ? (
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              className="relative z-10 h-8 shrink-0 border-foreground bg-transparent px-3 text-[11px] font-semibold uppercase tracking-[0.09em] text-foreground"
              onClick={() => onProposeAmendment(section.sectionKey)}
            >
              {t('card.proposeAmendment')}
            </Button>
          ) : null
        ) : (
          <SpaceContextStatusChip status={section.status} />
        )}
      </div>
      {featured || section.isCustom ? null : (
        <p className="-mt-2 text-1 text-neutral-11">
          {t(`leads.${section.sectionKey as BuiltinSpaceContextSectionKey}`)}
        </p>
      )}
      <div className="relative flex-1">
        {empty ? (
          <p className="text-[13px] leading-snug text-neutral-11">
            {t('card.emptyBody')}
          </p>
        ) : (
          <>
            {unofficial ? (
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-11">
                {section.status === 'proposed'
                  ? t('card.proposedText')
                  : t('card.draftText')}
              </p>
            ) : null}
            <div
              className={cn(
                featured ? 'max-h-[28rem]' : 'max-h-44',
                'space-y-3.5 overflow-hidden',
                unofficial &&
                  'border-l-2 border-dashed border-neutral-6 pl-3 text-neutral-11',
              )}
            >
              {lead ? (
                <p
                  className={cn(
                    unofficial ? 'text-neutral-11' : 'text-foreground',
                    featured
                      ? 'max-w-3xl text-4 leading-snug'
                      : 'text-[13px] leading-snug',
                  )}
                >
                  <InlineText source={lead} />
                </p>
              ) : null}
              {rest ? (
                <div className="border-t border-border/60 pt-3.5">
                  <MemoryProse
                    source={rest}
                    className={cn(
                      'text-[13px] leading-relaxed',
                      unofficial ? 'text-neutral-11' : 'text-foreground',
                    )}
                  />
                </div>
              ) : null}
            </div>
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background-2 to-transparent"
              aria-hidden
            />
          </>
        )}
      </div>
      {notice ? (
        <p className="text-[11px] font-medium text-neutral-11">{notice}</p>
      ) : null}
      <div
        className={cn(
          'flex items-center justify-between gap-3',
          !featured && 'border-t border-border/60 pt-2.5',
        )}
      >
        <div className="relative z-10 min-w-0 truncate text-[11px] text-neutral-11">
          {section.status === 'proposed' ? (
            <ProposedFooterMeta section={section} />
          ) : (
            <FooterParts
              parts={staticFooterParts({
                section,
                featured: !!featured,
                agreementHref,
              })}
            />
          )}
        </div>
        <CardAction
          section={section}
          canMutate={canMutate}
          proposalHref={proposalHref}
          onOpen={onOpen}
        />
      </div>
    </Card>
  );
}

/** One line telling members what is official and what is only suggested. */
export function sectionNotice(
  section: SpaceContextSectionRecord,
  t: SpaceContextT,
): string | null {
  if (section.pendingChange === 'remove') return t('notice.removal');
  if (section.pendingChange === 'add') return t('notice.addition');
  if (officialSectionMarkdown(section) == null) return null;
  if (section.status === 'proposed') return t('notice.amendmentOnVoting');
  if (section.hasDraftChanges) return t('notice.draftChanges');
  return null;
}

function CardAction({
  section,
  canMutate,
  proposalHref,
  onOpen,
}: {
  section: SpaceContextSectionRecord;
  canMutate: boolean;
  proposalHref: string | null;
  onOpen: (key: SpaceContextSectionKey) => void;
}) {
  const t = useTranslations('SpaceContext');
  const className =
    'relative z-10 inline-flex shrink-0 items-center gap-1 text-1 font-bold text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

  if (proposalHref) {
    return (
      <Link href={proposalHref} scroll={false} className={className}>
        {t('card.viewProposal')}
        <span aria-hidden>→</span>
      </Link>
    );
  }

  const label = ctaLabel(section, canMutate, t);
  return (
    <button
      type="button"
      className={className}
      onClick={() => onOpen(section.sectionKey)}
    >
      {label}
      {label === t('card.view') ? null : <span aria-hidden>→</span>}
    </button>
  );
}

function FooterParts({ parts }: { parts: ReactNode[] }) {
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? ' · ' : null}
          {part}
        </Fragment>
      ))}
    </>
  );
}

function AgreementRef({ href, label }: { href: string | null; label: string }) {
  if (!href) return <>{label}</>;
  return (
    <Link
      href={href}
      scroll={false}
      className="text-neutral-12 underline-offset-2 hover:underline"
    >
      {label}
    </Link>
  );
}

function staticFooterParts({
  section,
  featured,
  agreementHref,
}: {
  section: SpaceContextSectionRecord;
  featured: boolean;
  agreementHref: string | null;
}): ReactNode[] {
  if (section.status === 'ratified') {
    return [
      <RatifiedFooterMeta
        key="ratified"
        section={section}
        featured={featured}
        agreementHref={agreementHref}
      />,
    ];
  }
  if (section.status === 'draft') {
    return [<DraftFooterMeta key="draft" section={section} />];
  }
  return ['—'];
}

function RatifiedFooterMeta({
  section,
  featured,
  agreementHref,
}: {
  section: SpaceContextSectionRecord;
  featured: boolean;
  agreementHref: string | null;
}) {
  const t = useTranslations('SpaceContext');
  const format = useFormatter();
  const agreement = agreementNumber(
    section.ratifiedWeb3Id,
    section.ratifiedDocumentId,
  );
  const ratifiedAt = section.ratifiedAt ? new Date(section.ratifiedAt) : null;
  const ref = (
    <AgreementRef
      href={agreementHref}
      label={t('card.agreementRef', { agreement })}
    />
  );

  if (featured) {
    const parts: ReactNode[] = [
      <Fragment key="via">
        {t('card.ratifiedVia')} {ref}
      </Fragment>,
    ];
    if (ratifiedAt) {
      parts.push(format.dateTime(ratifiedAt, { dateStyle: 'medium' }));
    }
    if (section.lastEditorName) {
      parts.push(t('card.draftedBy', { name: section.lastEditorName }));
    }
    parts.push(t('card.version', { version: section.version }));
    return <FooterParts parts={parts} />;
  }

  const parts: ReactNode[] = [t('status.ratified'), ref];
  if (ratifiedAt) {
    parts.push(format.dateTime(ratifiedAt, { month: 'short', day: 'numeric' }));
  }
  return <FooterParts parts={parts} />;
}

function DraftFooterMeta({ section }: { section: SpaceContextSectionRecord }) {
  const t = useTranslations('SpaceContext');
  const format = useFormatter();
  const parts: ReactNode[] = [t('status.draft')];
  if (section.lastEditorName) {
    parts.push(section.lastEditorName);
  } else if (section.contributorCount > 0) {
    parts.push(t('card.contributors', { count: section.contributorCount }));
  }
  const updatedAt = new Date(section.updatedAt);
  if (!Number.isNaN(updatedAt.getTime())) {
    parts.push(
      t('card.edited', {
        when: format.relativeTime(updatedAt, new Date()),
      }),
    );
  }
  return <FooterParts parts={parts} />;
}

function ProposedFooterMeta({
  section,
}: {
  section: SpaceContextSectionRecord;
}) {
  const t = useTranslations('SpaceContext');
  const { proposalDetails } = useProposalDetailsWeb3Rpc({
    proposalId: section.proposalWeb3Id,
  });
  const parts: ReactNode[] = [t('status.onVoting')];

  if (!proposalDetails) {
    parts.push(section.proposalTitle ?? t('card.proposalFallback'));
    return <FooterParts parts={parts} />;
  }

  const remaining = proposalDetails.endTime.getTime() - Date.now();
  if (remaining <= 0 || proposalDetails.executed || proposalDetails.expired) {
    parts.push(t('card.votingClosed'));
  } else if (remaining >= DAY_MS) {
    parts.push(t('card.daysLeft', { count: Math.ceil(remaining / DAY_MS) }));
  } else {
    parts.push(
      t('card.hoursLeft', {
        count: Math.max(1, Math.ceil(remaining / HOUR_MS)),
      }),
    );
  }
  return <FooterParts parts={parts} />;
}

function ctaLabel(
  section: SpaceContextSectionRecord,
  canMutate: boolean,
  t: SpaceContextT,
): string {
  if (section.status === 'proposed') return t('card.view');
  if (!canMutate) {
    return section.status === 'ratified' ? t('card.view') : t('card.open');
  }
  if (section.status === 'not_started') return t('card.startDiscussion');
  return t('card.openDiscussion');
}
