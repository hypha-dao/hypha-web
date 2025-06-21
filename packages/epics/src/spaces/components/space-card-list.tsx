'use client';

import { SpaceCardWrapper, UseMembers } from '@hypha-platform/epics';
import Link from 'next/link';
import { Locale } from '@hypha-platform/i18n';
import { Space } from '@core/space';

export const getDhoPathGovernance = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/governance`;
};

export function SpaceCardList({
  lang,
  spaces,
  useMembers,
}: {
  lang: Locale;
  spaces: Space[];
  useMembers: UseMembers;
}) {
  return (
    <div
      data-testid="member-spaces-container"
      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
    >
      {spaces.map((space) => (
        <div key={space.id}>
          <Link href={getDhoPathGovernance(lang, space.slug as string)}>
            <SpaceCardWrapper
              description={space.description as string}
              icon={space.logoUrl || ''}
              leadImage={space.leadImage || ''}
              agreements={space.documentCount}
              title={space.title as string}
              spaceSlug={space.slug as string}
              useMembers={useMembers}
            />
          </Link>
        </div>
      ))}
    </div>
  );
}
