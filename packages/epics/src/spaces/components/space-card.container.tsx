'use client';

import { SpaceCardWrapper, UseMembers } from '@hypha-platform/epics';
import Link from 'next/link';
import { Locale } from '@hypha-platform/i18n';
import { Space } from '@hypha-platform/core/client';

export const getDhoPathGovernance = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/governance`;
};

type SpaceCardContainerProps = {
  lang: Locale;
  spaces: Space[];
  useMembers: UseMembers;
};

export const SpaceCardContainer = ({
  lang,
  spaces,
  useMembers,
}: SpaceCardContainerProps) => (
  <div
    data-testid="member-spaces-container"
    className="grid grid-cols-1 sm:grid-cols-2 gap-2"
  >
    {spaces.map((space) =>
      space.slug ? (
        <div key={space.id}>
          <Link
            href={getDhoPathGovernance(lang, space.slug)}
            aria-label={`View governance for ${space.title}`}
          >
            <SpaceCardWrapper
              description={space.description || ''}
              icon={space.logoUrl || ''}
              leadImage={space.leadImage || ''}
              agreements={space.documentCount}
              title={space.title || ''}
              spaceSlug={space.slug}
              useMembers={useMembers}
            />
          </Link>
        </div>
      ) : null,
    )}
  </div>
);
