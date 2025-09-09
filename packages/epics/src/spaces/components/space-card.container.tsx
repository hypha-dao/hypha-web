'use client';

import { SpaceCard } from '@hypha-platform/epics';
import Link from 'next/link';
import { Locale } from '@hypha-platform/i18n';
import { Space } from '@hypha-platform/core/client';

export const getDhoPathAgreements = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/agreements`;
};

export const getDhoPathOverview = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/overview`;
};

type SpaceCardContainerProps = {
  lang: Locale;
  spaces: Space[];
};

export const SpaceCardContainer = ({
  lang,
  spaces,
}: SpaceCardContainerProps) => (
  <div
    data-testid="member-spaces-container"
    className="grid grid-cols-1 sm:grid-cols-3 gap-2"
  >
    {spaces.map((space) =>
      space.slug ? (
        <div key={space.id}>
          <Link
            href={getDhoPathAgreements(lang, space.slug)}
            aria-label={`View agreements for ${space.title}`}
          >
            <SpaceCard
              description={space.description || ''}
              icon={space.logoUrl || ''}
              leadImage={space.leadImage || ''}
              members={space.memberCount}
              agreements={space.documentCount}
              title={space.title || ''}
              isSandbox={space.flags?.includes('sandbox') ?? false}
              isDemo={space.flags?.includes('demo') ?? false}
              web3SpaceId={space.web3SpaceId as number}
              configPath={`${getDhoPathAgreements(
                lang,
                space.slug,
              )}/space-configuration`}
            />
          </Link>
        </div>
      ) : null,
    )}
  </div>
);
