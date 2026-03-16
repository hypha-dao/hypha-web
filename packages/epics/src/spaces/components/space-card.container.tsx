'use client';

import { Locale } from '@hypha-platform/i18n';
import { Space } from '@hypha-platform/core/client';
import { getDhoPathAgreements } from '../../common';
import { SpaceCardWithDiscoverability } from './space-card-with-discoverability';

type SpaceCardContainerProps = {
  lang: Locale;
  spaces: Space[];
  showExitButton?: boolean;
};

export const SpaceCardContainer = ({
  lang,
  spaces,
  showExitButton,
}: SpaceCardContainerProps) => {
  const getHref = (slug: string) => getDhoPathAgreements(lang, slug);

  return (
    <div
      data-testid="member-spaces-container"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 auto-rows-fr"
    >
      {spaces.map((space) =>
        space.slug ? (
          <div key={space.id} className="h-full min-w-0">
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
