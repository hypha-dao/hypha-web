'use client';

import { Locale } from '@hypha-platform/i18n';
import { Space } from '@hypha-platform/core/client';
import { getDhoPathAgreements } from '../../common';
import { SpaceCard } from './space-card';
import Link from 'next/link';

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
  return (
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
                createdAt={space.createdAt}
                showExitButton={showExitButton}
              />
            </Link>
          </div>
        ) : null,
      )}
    </div>
  );
};
