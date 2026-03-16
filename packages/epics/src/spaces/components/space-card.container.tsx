'use client';

import { Locale } from '@hypha-platform/i18n';
import { Space } from '@hypha-platform/core/client';
import { getDhoPathAgreements } from '../../common';
import { SpaceCardWithDiscoverability } from './space-card-with-discoverability';

type SpaceCardContainerProps = {
  lang: Locale;
  spaces: Space[];
  showExitButton?: boolean;
  /** Query string for breadcrumb origin (e.g. "from=network" or "from=profile&profileSlug=xxx") */
  fromParam?: string;
};

export const SpaceCardContainer = ({
  lang,
  spaces,
  showExitButton,
  fromParam,
}: SpaceCardContainerProps) => {
  const getHref = (slug: string) => {
    const baseUrl = getDhoPathAgreements(lang, slug);
    return fromParam ? `${baseUrl}?${fromParam}` : baseUrl;
  };

  return (
    <div
      data-testid="member-spaces-container"
      className="grid grid-cols-1 sm:grid-cols-3 gap-2"
    >
      {spaces.map((space) =>
        space.slug ? (
          <div key={space.id}>
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
