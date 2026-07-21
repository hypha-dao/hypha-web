'use client';

import { useMemo } from 'react';
import { Locale } from '@hypha-platform/i18n';
import { Space } from '@hypha-platform/core/client';
import { getDhoPathDefaultLanding } from '../../common';
import { SpaceCardWithDiscoverability } from './space-card-with-discoverability';
import { useMarketplaceListings } from '../../highlights';
import { cn } from '@hypha-platform/ui-utils';

type SpaceCardContainerProps = {
  lang: Locale;
  spaces: Space[];
  showExitButton?: boolean;
  gridClassName?: string;
};

export const SpaceCardContainer = ({
  lang,
  spaces,
  showExitButton,
  gridClassName,
}: SpaceCardContainerProps) => {
  const getHref = (slug: string) => getDhoPathDefaultLanding(lang, slug);
  const { items } = useMarketplaceListings(true);
  const publishedSlugs = useMemo(
    () => new Set(items.map((item) => item.spaceSlug)),
    [items],
  );

  return (
    <div
      data-testid="member-spaces-container"
      className={cn(
        'grid grid-cols-1 gap-2 sm:grid-cols-3 auto-rows-fr items-stretch',
        gridClassName,
      )}
    >
      {spaces.map((space) =>
        space.slug ? (
          <div key={space.id} className="flex flex-col h-full">
            <SpaceCardWithDiscoverability
              space={space}
              getHref={getHref}
              isLoading={false}
              showExitButton={showExitButton}
              hasPublishedHighlights={publishedSlugs.has(space.slug)}
            />
          </div>
        ) : null,
      )}
    </div>
  );
};
