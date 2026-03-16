'use client';

import {
  SpaceCard,
  getDhoPathAgreements,
} from '@hypha-platform/epics';
import {
  isSpaceArchived,
  DEFAULT_SPACE_LEAD_IMAGE,
  type Space,
} from '@hypha-platform/core/client';
import { Carousel, CarouselContent, CarouselItem } from '@hypha-platform/ui';
import Link from 'next/link';
import { Locale } from '@hypha-platform/i18n';
import { useBreadcrumbFromQuery } from './breadcrumbs-root-selector';

export function SpacesCarouselWithFrom({
  spaces,
  lang,
}: {
  spaces: Space[];
  lang: Locale;
}) {
  const fromQuery = useBreadcrumbFromQuery();

  return (
    <Carousel className="my-6 mt-6">
      <CarouselContent className="pb-5" showScrollbar>
        {spaces.map((space) => {
          const baseHref = getDhoPathAgreements(lang, space.slug as string);
          const href = fromQuery ? `${baseHref}?${fromQuery}` : baseHref;
          return (
            <CarouselItem
              key={space.id}
              className="w-full sm:w-[454px] max-w-[454px] flex-shrink-0"
            >
              <Link className="flex flex-col flex-1" href={href}>
                <SpaceCard
                  description={space.description as string}
                  icon={space.logoUrl || ''}
                  leadImage={space.leadImage || DEFAULT_SPACE_LEAD_IMAGE}
                  members={space.memberCount}
                  agreements={space.documentCount}
                  title={space.title as string}
                  isSandbox={space.flags?.includes('sandbox') ?? false}
                  isDemo={space.flags?.includes('demo') ?? false}
                  isArchived={isSpaceArchived(space)}
                  web3SpaceId={space.web3SpaceId as number}
                  configPath={`${baseHref}/space-configuration`}
                  createdAt={space.createdAt}
                />
              </Link>
            </CarouselItem>
          );
        })}
      </CarouselContent>
    </Carousel>
  );
}
