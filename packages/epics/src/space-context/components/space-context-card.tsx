'use client';

import {
  officialSectionMarkdown,
  splitLeadParagraph,
  stripMatchingLeadingHeading,
  useProposalDetailsWeb3Rpc,
  type SpaceContextSectionKey,
  type SpaceContextSectionRecord,
} from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { Card, CardTitle } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Fragment, type MouseEvent, type ReactNode } from 'react';
import {
  InlineText,
  MemoryProse,
} from '../../coherence/components/memory-prose';
import { getProposalPath } from '../../common/get-path-function';
import {
  SpaceContextChangeBadge,
  SpaceContextStatusChip,
} from './space-context-status-chip';

export type SpaceContextT = ReturnType<typeof useTranslations<'SpaceContext'>>;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const NESTED_CONTROLS =
  'a, button, input, textarea, select, label, [role="button"]';

export function SpaceContextCard({
  section,
  spaceSlug,
  selected,
  featured,
  onOpen,
  onRead,
  onShowDraft,
}: {
  section: SpaceContextSectionRecord;
  spaceSlug: string;
  selected?: boolean;
  featured?: boolean;
  onOpen: (key: SpaceContextSectionKey) => void;
  onRead: (key: SpaceContextSectionKey) => void;
  onShowDraft?: (key: SpaceContextSectionKey) => void;
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
  const notice = sectionNotice(section, t);
  const showStatus = section.status !== 'ratified';
  const draftHidden =
    !unofficial && section.hasDraftChanges && !!section.markdown.trim();
  const linkClassName =
    'inline-flex shrink-0 items-center gap-1 text-1 font-bold text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

  const readFromSurface = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest(NESTED_CONTROLS)) return;
    // Dragging to select text should not open the reader.
    if (window.getSelection()?.toString()) return;
    onRead(section.sectionKey);
  };

  return (
    <Card
      onClick={readFromSurface}
      className={cn(
        'relative flex h-full cursor-pointer flex-col transition-colors hover:border-neutral-11',
        featured ? 'gap-2.5 px-6 pb-[18px] pt-5' : 'min-h-[210px] gap-3.5 p-6',
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
              className="text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={() => onRead(section.sectionKey)}
              aria-label={t('card.read', { section: title })}
            >
              {title}
            </button>
          </CardTitle>
          {featured && showStatus ? (
            <SpaceContextStatusChip status={section.status} />
          ) : null}
          <SpaceContextChangeBadge change={section.pendingChange} />
        </div>
        {!featured && showStatus ? (
          <SpaceContextStatusChip status={section.status} />
        ) : null}
      </div>
      <div className="relative flex-1">
        {empty ? (
          <p className="text-[13px] leading-snug text-neutral-11">
            {t('card.emptyBody')}
          </p>
        ) : (
          <>
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
          'space-y-2',
          !featured && 'border-t border-border/60 pt-2.5',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 truncate text-[11px] text-neutral-11">
            {section.status === 'proposed' ? (
              <ProposedFooterMeta section={section} />
            ) : section.status === 'draft' ? (
              <DraftFooterMeta section={section} />
            ) : null}
          </div>
          <button
            type="button"
            className={linkClassName}
            onClick={() => onOpen(section.sectionKey)}
          >
            {t('card.openDiscussion')}
            <span aria-hidden>→</span>
          </button>
        </div>
        {proposalHref || (draftHidden && onShowDraft) ? (
          <div className="flex flex-wrap items-center gap-4">
            {draftHidden && onShowDraft ? (
              <button
                type="button"
                className={linkClassName}
                onClick={() => onShowDraft(section.sectionKey)}
              >
                {t('chat.showDraft')}
              </button>
            ) : null}
            {proposalHref ? (
              <Link
                href={proposalHref}
                scroll={false}
                className={linkClassName}
              >
                {t('card.viewProposal')}
                <span aria-hidden>→</span>
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/** One line about a suggested addition or removal of the section. */
export function sectionNotice(
  section: SpaceContextSectionRecord,
  t: SpaceContextT,
): string | null {
  if (section.pendingChange === 'remove') return t('notice.removal');
  if (section.pendingChange === 'add') return t('notice.addition');
  return null;
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
