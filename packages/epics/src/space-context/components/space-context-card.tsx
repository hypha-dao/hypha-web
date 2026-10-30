'use client';

import {
  headingForSectionKey,
  splitLeadParagraph,
  stripMatchingLeadingHeading,
  useProposalDetailsWeb3Rpc,
  type SpaceContextSectionKey,
  type SpaceContextSectionRecord,
} from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { ArrowRight } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { MemoryProse } from '../../coherence/components/memory-prose';
import { getProposalPath } from '../../common/get-path-function';
import { agreementNumber } from './agreement-number';
import { SpaceContextStatusChip } from './space-context-status-chip';

type SpaceContextT = ReturnType<typeof useTranslations<'SpaceContext'>>;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export function SpaceContextCard({
  section,
  spaceSlug,
  selected,
  featured,
  canMutate,
  onOpen,
  onProposeAmendment,
}: {
  section: SpaceContextSectionRecord;
  spaceSlug: string;
  selected?: boolean;
  featured?: boolean;
  canMutate: boolean;
  onOpen: (key: SpaceContextSectionKey) => void;
  onProposeAmendment?: (key: SpaceContextSectionKey) => void;
}) {
  const t = useTranslations('SpaceContext');
  const locale = useLocale() as Locale;
  const title = headingForSectionKey(section.sectionKey);
  const body = stripMatchingLeadingHeading(section.markdown, title);
  const empty = !body.trim();
  const { lead, rest } = splitLeadParagraph(body);
  const proposalHref =
    section.status === 'proposed' && section.proposalSlug
      ? getProposalPath(locale, spaceSlug, section.proposalSlug)
      : null;
  const agreementHref = section.ratifiedSlug
    ? getProposalPath(locale, spaceSlug, section.ratifiedSlug)
    : null;

  return (
    <Card
      className={cn(
        'flex h-full flex-col border-border/70',
        featured ? 'border-success-8' : 'min-h-[280px]',
        selected && 'border-foreground',
        section.status === 'not_started' && 'border-dashed',
      )}
    >
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <CardTitle className={featured ? 'text-5' : 'text-4'}>
            {title}
          </CardTitle>
          {featured ? <SpaceContextStatusChip status={section.status} /> : null}
        </div>
        {featured ? (
          canMutate && section.status === 'ratified' && onProposeAmendment ? (
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              className="h-9 shrink-0 uppercase tracking-[0.12em]"
              onClick={() => onProposeAmendment(section.sectionKey)}
            >
              {t('card.proposeAmendment')}
            </Button>
          ) : null
        ) : (
          <SpaceContextStatusChip status={section.status} />
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4 pt-0">
        <div className="relative min-h-24">
          {empty ? (
            <div className="space-y-1 text-2 text-neutral-11">
              <p>{t(`leads.${section.sectionKey}`)}</p>
              <p>{t('card.emptyBody')}</p>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  featured ? 'max-h-[28rem]' : 'max-h-44',
                  'space-y-3 overflow-hidden',
                )}
              >
                {lead ? (
                  <p
                    className={cn(
                      'text-neutral-12',
                      featured
                        ? 'max-w-3xl text-5 font-medium leading-snug'
                        : 'text-3 leading-snug',
                    )}
                  >
                    {lead}
                  </p>
                ) : null}
                {rest ? (
                  <MemoryProse
                    source={rest}
                    className="text-2 leading-relaxed text-neutral-11"
                  />
                ) : null}
              </div>
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background-2 to-transparent"
                aria-hidden
              />
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
          <div className="min-w-0 truncate text-1 text-neutral-11">
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
      </CardContent>
    </Card>
  );
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
  const className = 'h-10 shrink-0 gap-1.5 px-3';
  const arrow = (
    <ArrowRight className="size-3.5" strokeWidth={1.25} aria-hidden />
  );

  if (proposalHref) {
    return (
      <Button
        asChild
        variant="ghost"
        colorVariant="neutral"
        className={className}
      >
        <Link href={proposalHref} scroll={false}>
          {t('card.viewProposal')}
          {arrow}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      colorVariant="neutral"
      className={className}
      onClick={() => onOpen(section.sectionKey)}
    >
      {ctaLabel(section, canMutate, t)}
      {arrow}
    </Button>
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
  parts.push(
    t('card.yesShare', {
      percent: Math.round(proposalDetails.unityPercentage),
    }),
  );
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
  if (section.status === 'not_started') return t('card.startWithAgent');
  return t('card.continue');
}
