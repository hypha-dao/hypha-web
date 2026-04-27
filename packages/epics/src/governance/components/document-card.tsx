'use client';

import {
  Skeleton,
  Card,
  Badge,
  type BadgeItem,
  BadgesList,
} from '@hypha-platform/ui';
import { PersonAvatar } from '../../people/components/person-avatar';
import { type Creator } from '../../people/components/person-label';
import { stripMarkdown } from '@hypha-platform/ui-utils';
import {
  DocumentStatus,
  stripHyphaInvestmentFormMarker,
  useEvents,
  useIsDelegate,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { stripExchangeDetailsBlock } from '../utils/strip-exchange-details-block';
import React from 'react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { cn } from '@hypha-platform/ui-utils';
import { Calendar } from 'lucide-react';

interface Document {
  id?: number;
  title?: string;
  description?: string;
  createdAt?: Date;
  status?: DocumentStatus;
}

interface DocumentCardProps {
  isLoading: boolean;
  /** Client route to proposal detail (card body links here; vote UI stays outside the link). */
  detailHref?: string;
  leadImage?: string;
  creator?: Creator;
  badges?: BadgeItem[];
  interactions?: React.ReactNode;
}

function stripHtmlComments(text: string): string {
  let result = text;
  for (;;) {
    const start = result.indexOf('<!--');
    if (start === -1) break;
    const end = result.indexOf('-->', start + 4);
    if (end === -1) {
      result = result.slice(0, start);
      break;
    }
    result = result.slice(0, start) + result.slice(end + 3);
  }
  return result;
}

/**
 * MDX comments (`{/* … *\/}`) are invisible when the description is rendered
 * via `<Markdown>` on the proposal detail page, but the card preview shows the
 * description as plain text via `stripMarkdown(stripDescription(...))`, which
 * leaves the literal `{/* … *\/}` syntax visible. We embed structured markers
 * with this syntax (e.g. `buildExchangeDepositEscrowMarker`) so they need to
 * be removed from the card preview too.
 */
function stripMdxComments(text: string): string {
  let result = text;
  for (;;) {
    const start = result.indexOf('{/*');
    if (start === -1) break;
    const end = result.indexOf('*/}', start + 3);
    if (end === -1) {
      result = result.slice(0, start);
      break;
    }
    result = result.slice(0, start) + result.slice(end + 3);
  }
  return result;
}

function stripDescription(description: string): string {
  if (!description) return '';
  const withoutInvestmentMarker = stripHyphaInvestmentFormMarker(description);
  const withoutExchangeDetails = stripExchangeDetailsBlock(
    withoutInvestmentMarker,
    { replaceWith: '\n' },
  );
  return stripMdxComments(stripHtmlComments(withoutExchangeDetails))
    .replace(/\\([\[\]\(\)\{\}])/g, '$1')
    .replace(/&#x([0-9A-Fa-f]+);/gi, (full, hex) => {
      const codePoint = Number.parseInt(hex, 16);
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff)
        return full;
      return String.fromCodePoint(codePoint);
    })
    .replace(/&#(\d+);/g, (full, dec) => {
      const codePoint = Number.parseInt(dec, 10);
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff)
        return full;
      return String.fromCodePoint(codePoint);
    })
    .trim();
}

export const DocumentCard: React.FC<DocumentCardProps & Document> = ({
  id: documentId,
  title,
  description,
  isLoading,
  detailHref,
  leadImage,
  creator,
  badges,
  interactions,
  createdAt,
  status,
}) => {
  const { id: spaceSlug } = useParams();
  const { space: currentSpace } = useSpaceBySlug(spaceSlug as string);
  const { isDelegate } = useIsDelegate({
    spaceId: currentSpace?.web3SpaceId as number,
    userAddress: creator?.address as `0x${string}`,
  });
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  const formatDateTime = (date: string | number | Date) => {
    const parsedDate = date instanceof Date ? date : new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return '';
    }

    return format.dateTime(parsedDate, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };
  const type = React.useMemo(() => {
    switch (status) {
      case 'accepted':
        return 'executeProposal';
      case 'rejected':
        return 'rejectProposal';
      default:
        return undefined;
    }
  }, [status]);
  const { events, isLoadingEvents } = useEvents({
    type,
    referenceEntity: 'document',
    referenceId: documentId,
  });
  const event = !isLoadingEvents && events instanceof Array ? events[0] : null;

  const list = badges ?? [];
  const typeBadge = list.length > 1 ? list[0] : undefined;
  const statusBadge = list.length > 1 ? list[1] : list[0];

  const creatorDisplay =
    [creator?.name, creator?.surname].filter(Boolean).join(' ').trim() ||
    '\u00a0';

  const heroSrc = creator?.avatarUrl?.trim() || leadImage;

  const dateLine = (() => {
    if (isLoading || isLoadingEvents) return '';
    if (type === 'executeProposal' && event) {
      return tCommon('acceptedOn', {
        date: formatDateTime(event.createdAt),
      });
    }
    if (type === 'rejectProposal' && event) {
      return tCommon('rejectedOn', {
        date: formatDateTime(event.createdAt),
      });
    }
    if (!type && createdAt) {
      return tCommon('createdOn', {
        date: formatDateTime(createdAt),
      });
    }
    return '';
  })();

  const descriptionPlain = stripMarkdown(stripDescription(description ?? ''), {
    orderedListMarkers: false,
    unorderedListMarkers: false,
  });

  const heroVisual = (
    <div className="relative isolate overflow-hidden">
      <div
        className={cn(
          'relative h-[5.25rem] w-full overflow-hidden bg-muted/50',
          'after:pointer-events-none after:absolute after:inset-0 after:bg-gradient-to-b after:from-transparent after:via-background/55 after:to-background',
        )}
      >
        {isLoading ? (
          <Skeleton
            className="h-full w-full rounded-none"
            loading
            height="100%"
          />
        ) : heroSrc ? (
          <img
            src={heroSrc}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-[2px] motion-reduce:scale-100 motion-reduce:blur-none"
          />
        ) : (
          <div
            className="absolute inset-0 bg-gradient-to-br from-accent-5/35 via-muted/60 to-background"
            aria-hidden
          />
        )}
      </div>
      <div className="relative z-10 -mt-10 px-3">
        <PersonAvatar
          avatarSrc={creator?.avatarUrl}
          userName={`${creator?.name ?? ''} ${creator?.surname ?? ''}`.trim()}
          size="lg"
          isLoading={isLoading}
          shape="circle"
          className="shrink-0 shadow-md ring-4 ring-card"
        />
      </div>
    </div>
  );

  const mainInner = (
    <div className="min-w-0 space-y-2 px-3 pb-3 pt-1">
      {heroVisual}
      <div className="flex min-w-0 items-start justify-between gap-1.5 pt-0.5">
        {isLoading ? (
          <Skeleton className="my-0.5" width="7rem" height="1.1rem" loading />
        ) : (
          <p
            className="text-4 line-clamp-2 min-w-0 flex-1 font-medium leading-tight"
            title={title || undefined}
          >
            {title || '—'}
          </p>
        )}
        {typeBadge ? (
          <Badge
            className="h-fit max-w-[40%] shrink-0 text-[10px] font-medium uppercase"
            variant={typeBadge.variant}
            colorVariant={typeBadge.colorVariant}
            isLoading={isLoading}
          >
            {typeBadge.label}
          </Badge>
        ) : statusBadge && !isLoading ? (
          <Badge
            className="h-fit max-w-[40%] shrink-0 text-[10px] font-medium uppercase"
            variant={statusBadge.variant}
            colorVariant={statusBadge.colorVariant}
          >
            {statusBadge.label}
          </Badge>
        ) : isLoading ? (
          <Skeleton className="my-0.5 h-5 w-16 shrink-0" loading />
        ) : null}
      </div>
      {isLoading ? (
        <Skeleton className="mt-0.5" width="5rem" height="0.7rem" loading />
      ) : (
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2">
          <p
            className="line-clamp-1 min-w-0 flex-1 text-1 text-muted-foreground"
            title={creatorDisplay.trim() || undefined}
          >
            {creatorDisplay}
          </p>
          {isDelegate ? (
            <Badge colorVariant="accent" variant="outline" size={1}>
              {tCommon('delegateBadge')}
            </Badge>
          ) : null}
        </div>
      )}
      {statusBadge && typeBadge ? (
        <div className="flex min-h-5 w-full max-w-full flex-wrap content-center gap-1.5">
          <BadgesList isLoading={isLoading} badges={[statusBadge]} />
        </div>
      ) : null}
      {isLoading ? (
        <Skeleton className="mt-0.5" width="100%" height="0.75rem" loading />
      ) : (
        <p
          className="line-clamp-2 min-h-8 text-1 text-muted-foreground"
          title={descriptionPlain || undefined}
        >
          {descriptionPlain || null}
        </p>
      )}
      {isLoading ? (
        <Skeleton className="mt-0.5" width="100%" height="0.75rem" loading />
      ) : dateLine ? (
        <p
          className="line-clamp-2 text-1 text-muted-foreground"
          title={dateLine}
        >
          <Calendar
            className="mr-0.5 inline h-3 w-3 -translate-y-0.5 opacity-80"
            aria-hidden
          />
          {dateLine}
        </p>
      ) : null}
    </div>
  );

  const mainBlock =
    detailHref && !isLoading ? (
      <Link
        href={detailHref}
        scroll={false}
        className="block w-full no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {mainInner}
      </Link>
    ) : (
      mainInner
    );

  const interactionFooter =
    interactions != null ? (
      <div
        className="space-y-2 border-t border-border/60 p-2.5"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {interactions}
      </div>
    ) : null;

  if (isLoading) {
    return (
      <Card
        className="h-full min-h-36 w-full min-w-0 p-0"
        data-testid="document-card-skeleton"
      >
        {mainBlock}
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'flex h-full min-h-36 w-full min-w-0 flex-col overflow-hidden p-0',
        'border-border/80 transition-shadow duration-150 hover:border-border hover:shadow-sm',
        'motion-reduce:transition-none',
      )}
      data-testid="document-card-grid"
    >
      {mainBlock}
      {interactionFooter}
    </Card>
  );
};
