'use client';

import { Locale } from '@hypha-platform/i18n';
import { Space } from '@hypha-platform/core/client';
import { getDhoPathDefaultLanding } from '../../common';
import { SpaceCardWithDiscoverability } from './space-card-with-discoverability';
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

  return (
    <div
      data-testid="member-spaces-container"
      className={cn(
        'grid auto-rows-fr grid-cols-1 items-stretch gap-2 sm:grid-cols-3',
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
            />
          </div>
        ) : null,
      )}
    </div>
  );
};
