'use client';

import {
  Skeleton,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@hypha-platform/ui';
import { Image } from '@hypha-platform/ui';
import { PersonLabel } from '../../people/components/person-label';
import { type Creator } from '../../people/components/person-label';
import { type BadgeItem, BadgesList } from '@hypha-platform/ui';
import { cn, stripMarkdown } from '@hypha-platform/ui-utils';
import {
  DocumentStatus,
  stripHyphaInvestmentFormMarker,
  useEvents,
} from '@hypha-platform/core/client';
import { stripExchangeDetailsBlock } from '../utils/strip-exchange-details-block';
import { stripEnergyProposalMarker } from '../utils/energy-proposal-markers';
import React from 'react';
import { useFormatter, useTranslations } from 'next-intl';

/** Compact lead strip — tall enough to read as media, short enough for dense grids. */
const LEAD_IMAGE_HEIGHT_PX = 80;

interface Document {
  id?: number;
  title?: string;
  description?: string;
  createdAt?: Date;
  status?: DocumentStatus;
}

interface DocumentCardProps {
  isLoading: boolean;
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
  // Strip investment marker before markdown — markdown can mangle `__` delimiters.
  const withoutInvestmentMarker = stripHyphaInvestmentFormMarker(description);
  // Exchange proposals embed a block of structured details between
  // `<!-- exchange-details:start -->` / `<!-- exchange-details:end -->`. The
  // content between those markers is plain markdown (wallet addresses, leg
  // tables) so `stripHtmlComments` alone leaves it on the card preview. Drop
  // the whole block so the card only shows the user-written description.
  const withoutExchangeDetails = stripExchangeDetailsBlock(
    withoutInvestmentMarker,
    { replaceWith: '\n' },
  );
  // Energy proposals embed a `__hypha_energy_proposal__ … __end…__` JSON marker
  // that markdown renders as bold text + raw JSON on the card preview. Strip it
  // so the card shows only the user-authored description.
  const withoutEnergyMarker = stripEnergyProposalMarker(withoutExchangeDetails);
  return stripMdxComments(stripHtmlComments(withoutEnergyMarker))
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
  leadImage,
  creator,
  badges,
  interactions,
  createdAt,
  status,
}) => {
  const tCommon = useTranslations('Common');
  const format = useFormatter();
  const formatDateTime = (date: string | number | Date) => {
    const parsedDate = date instanceof Date ? date : new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return '';
    }

    return format.dateTime(parsedDate, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
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
  return (
    <Card
      className={cn(
        'group flex h-full w-full flex-col',
        'transition-[border-color,background-color] duration-200 ease-out',
        'hover:border-border hover:bg-background-3/40',
      )}
    >
      <CardHeader
        className="flex-shrink-0 overflow-hidden rounded-tl-lg rounded-tr-lg p-0"
        style={{ height: LEAD_IMAGE_HEIGHT_PX }}
      >
        <Skeleton
          loading={isLoading}
          className="h-full min-w-full"
          height={`${LEAD_IMAGE_HEIGHT_PX}px`}
          width="250px"
        >
          <Image
            className="h-full w-full rounded-tl-lg rounded-tr-lg object-cover"
            src={leadImage || '/placeholder/document-lead-image.webp'}
            alt={title || ''}
            width={250}
            height={LEAD_IMAGE_HEIGHT_PX}
          />
        </Skeleton>
      </CardHeader>
      <CardContent className="relative flex flex-1 flex-col gap-2 p-3 pt-3">
        <div className="flex min-w-0 flex-col items-start gap-1">
          {(badges?.length ?? 0) > 0 || isLoading ? (
            <BadgesList
              isLoading={isLoading}
              badges={(badges ?? []).slice(0, 2)}
            />
          ) : null}
          <Skeleton
            className="min-w-full"
            width="120px"
            height="18px"
            loading={isLoading}
          >
            <CardTitle className="line-clamp-2 text-3 font-medium tracking-tight">
              {title}
            </CardTitle>
          </Skeleton>
          <PersonLabel isLoading={isLoading} creator={creator} />
        </div>
        {description ? (
          <Skeleton
            className="min-w-full"
            width="200px"
            height="16px"
            loading={isLoading}
          >
            <p className="line-clamp-1 w-full text-1 font-normal text-muted-foreground">
              {stripMarkdown(stripDescription(description ?? ''), {
                orderedListMarkers: false,
                unorderedListMarkers: false,
              })}
            </p>
          </Skeleton>
        ) : null}
        <div className="text-1 font-normal text-muted-foreground">
          <Skeleton
            className="min-w-full"
            width="160px"
            height="16px"
            loading={isLoading || isLoadingEvents}
          >
            {type === 'executeProposal' && event && (
              <>
                {tCommon('acceptedOn', {
                  date: formatDateTime(event.createdAt),
                })}
              </>
            )}
            {type === 'rejectProposal' && event && (
              <>
                {tCommon('rejectedOn', {
                  date: formatDateTime(event.createdAt),
                })}
              </>
            )}
            {!type && createdAt && (
              <>
                {tCommon('createdOn', {
                  date: formatDateTime(createdAt),
                })}
              </>
            )}
          </Skeleton>
        </div>
        {interactions ? (
          <div className="mt-auto pt-1">{interactions}</div>
        ) : null}
      </CardContent>
    </Card>
  );
};
