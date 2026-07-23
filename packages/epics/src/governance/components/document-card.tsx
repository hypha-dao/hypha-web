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
import { stripMarkdown } from '@hypha-platform/ui-utils';
import {
  DocumentStatus,
  stripHyphaInvestmentFormMarker,
  useEvents,
} from '@hypha-platform/core/client';
import { stripExchangeDetailsBlock } from '../utils/strip-exchange-details-block';
import { stripEnergyProposalMarker } from '../utils/energy-proposal-markers';
import React from 'react';
import { useFormatter, useTranslations } from 'next-intl';

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
  return (
    <Card className="h-full w-full space-y-5">
      <CardHeader className="p-0 rounded-tl-md rounded-tr-md overflow-hidden h-[150px]">
        <Skeleton
          loading={isLoading}
          className="min-w-full"
          height="150px"
          width="250px"
        >
          <Image
            className="rounded-tl-lg rounded-tr-lg object-cover w-full h-full"
            src={leadImage || '/placeholder/document-lead-image.webp'}
            alt={title || ''}
            width={250}
            height={150}
          />
        </Skeleton>
      </CardHeader>
      <CardContent className="relative space-y-4">
        <div className="flex flex-col items-start space-y-2">
          <BadgesList isLoading={isLoading} badges={badges ?? []} />
          <Skeleton
            className="min-w-full"
            width="120px"
            height="18px"
            loading={isLoading}
          >
            <CardTitle>{title}</CardTitle>
          </Skeleton>
          <PersonLabel isLoading={isLoading} creator={creator} />
        </div>
        <div className="flex flex-grow text-1 text-neutral-11">
          <Skeleton
            className="min-w-full"
            width="200px"
            height="48px"
            loading={isLoading}
          >
            <div className="line-clamp-3 w-full">
              {stripMarkdown(stripDescription(description ?? ''), {
                orderedListMarkers: false,
                unorderedListMarkers: false,
              })}
            </div>
          </Skeleton>
        </div>
        <div className="flex flex-grow text-1 text-neutral-11">
          <Skeleton
            className="min-w-full"
            width="200px"
            height="48px"
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
        {interactions}
      </CardContent>
    </Card>
  );
};
